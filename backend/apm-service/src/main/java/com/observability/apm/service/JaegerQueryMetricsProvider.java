package com.observability.apm.service;

import com.observability.apm.config.QueryMetricsProperties;
import com.observability.apm.dto.MetricDataPoint;
import com.observability.apm.dto.QueryMetricsResponse;
import com.observability.apm.dto.TimeSeries;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import com.observability.apm.jaeger.JaegerResponse.JaegerSpan;
import com.observability.apm.jaeger.JaegerResponse.JaegerTag;
import com.observability.apm.jaeger.JaegerResponse.JaegerTrace;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Jaeger-based query metrics provider.
 * Extracts DB operation metrics from Jaeger trace spans using OTel semantic conventions.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JaegerQueryMetricsProvider {

    private static final Pattern SQL_OPERATION_PATTERN =
            Pattern.compile("^\\s*(SELECT|INSERT|UPDATE|DELETE|MERGE|UPSERT|CREATE|ALTER|DROP|CALL)\\b",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern SQL_TABLE_PATTERN =
            Pattern.compile("(?:FROM|INTO|UPDATE|JOIN)\\s+[`\"']?(\\w+)[`\"']?",
                    Pattern.CASE_INSENSITIVE);

    private final JaegerClient jaegerClient;
    private final QueryMetricsProperties config;

    /**
     * Build query metrics from Jaeger trace data.
     */
    public QueryMetricsResponse getQueryMetrics(String serviceName, Instant start, Instant end,
                                                  long stepSeconds) {
        List<String> diagnostics = new ArrayList<>();

        // Fetch traces from Jaeger
        JaegerResponse response = jaegerClient.getTraces(
                serviceName, null, start, end, null, null, config.getJaegerTraceLimit(), null);

        List<JaegerTrace> traces = response.getData() != null ? response.getData() : List.of();
        diagnostics.add("[jaeger] Fetched " + traces.size() + " traces for service: " + serviceName);

        // Extract DB spans from all traces
        List<DbSpanData> dbSpans = new ArrayList<>();
        int totalSpans = 0;
        for (JaegerTrace trace : traces) {
            if (trace.getSpans() == null) continue;
            for (JaegerSpan span : trace.getSpans()) {
                totalSpans++;
                DbSpanData dbSpan = extractDbSpan(span);
                if (dbSpan != null) {
                    dbSpans.add(dbSpan);
                }
            }
        }
        diagnostics.add("[jaeger] Scanned " + totalSpans + " spans, found " + dbSpans.size() + " DB operations");

        if (dbSpans.isEmpty()) {
            diagnostics.add("[jaeger] No DB spans found (looking for db.system tag)");
            return QueryMetricsResponse.builder()
                    .serviceName(serviceName)
                    .queries(List.of())
                    .latencyByOperation(List.of())
                    .current(QueryMetricsResponse.InstantQueryMetrics.builder().slowQueryCount(0).build())
                    .executedQueries(diagnostics)
                    .build();
        }

        long rangeSecs = Math.max(1, end.getEpochSecond() - start.getEpochSecond());

        // Build per-operation summaries
        List<QueryMetricsResponse.QuerySummary> queries = buildQuerySummaries(dbSpans, rangeSecs);
        int slowCount = (int) queries.stream().filter(QueryMetricsResponse.QuerySummary::isSlowQuery).count();

        diagnostics.add("[jaeger] Operations found: " + queries.stream()
                .map(q -> q.getOperation() + " " + q.getCollection())
                .collect(Collectors.joining(", ")));

        // Build time-series
        long startEpoch = start.getEpochSecond();
        long endEpoch = end.getEpochSecond();

        TimeSeries avgLatency = buildOverallPercentileTimeSeries(dbSpans, startEpoch, endEpoch, stepSeconds, 0.50, "db_latency_p50");
        TimeSeries p95Latency = buildOverallPercentileTimeSeries(dbSpans, startEpoch, endEpoch, stepSeconds, 0.95, "db_latency_p95");
        TimeSeries queryRate = buildQueryRateTimeSeries(dbSpans, startEpoch, endEpoch, stepSeconds);
        List<TimeSeries> latencyByOp = buildPerOperationTimeSeries(dbSpans, startEpoch, endEpoch, stepSeconds);

        // Current instant values (from last bucket)
        List<Double> allDurations = dbSpans.stream().map(s -> s.durationSeconds).sorted().toList();
        QueryMetricsResponse.InstantQueryMetrics current = QueryMetricsResponse.InstantQueryMetrics.builder()
                .avgLatency(percentile(allDurations, 0.50))
                .p95Latency(percentile(allDurations, 0.95))
                .queryRate((double) dbSpans.size() / rangeSecs)
                .slowQueryCount(slowCount)
                .build();

        return QueryMetricsResponse.builder()
                .serviceName(serviceName)
                .queries(queries)
                .avgLatency(avgLatency)
                .p95Latency(p95Latency)
                .queryRate(queryRate)
                .latencyByOperation(latencyByOp)
                .current(current)
                .executedQueries(diagnostics)
                .build();
    }

    // ── DB span extraction ──────────────────────────────────────────────────────

    private record DbSpanData(
            String operation,
            String collection,
            String dbName,
            String statement,
            double durationSeconds,
            long startTimeEpochSeconds,
            boolean hasError
    ) {}

    /**
     * Extract DB span data from a Jaeger span. Returns null if the span is not a DB operation.
     */
    private DbSpanData extractDbSpan(JaegerSpan span) {
        Map<String, String> tags = extractTags(span);

        // A span is a DB operation if it has db.system tag
        if (!tags.containsKey("db.system")) return null;

        String operation = resolveOperation(tags, span.getOperationName());
        String dbName = resolveDbName(tags);
        String table = resolveTable(tags);
        String statement = tags.get("db.statement");
        if (statement == null) statement = tags.get("db.query.text");

        // Build collection as db.table format (e.g. "mydb.users")
        String collection = buildCollectionLabel(dbName, table, tags);

        double durationSec = span.getDuration() / 1_000_000.0;
        long startEpochSec = span.getStartTime() / 1_000_000;
        boolean hasError = "true".equals(tags.get("error")) || "ERROR".equals(tags.get("otel.status_code"));

        return new DbSpanData(operation, collection, dbName, statement, durationSec, startEpochSec, hasError);
    }

    private Map<String, String> extractTags(JaegerSpan span) {
        Map<String, String> tags = new LinkedHashMap<>();
        if (span.getTags() != null) {
            for (JaegerTag tag : span.getTags()) {
                tags.put(tag.getKey(), String.valueOf(tag.getValue()));
            }
        }
        return tags;
    }

    private String resolveOperation(Map<String, String> tags, String spanOperationName) {
        // Try OTel semantic convention tags
        String op = tags.get("db.operation.name");
        if (op == null) op = tags.get("db.operation");
        if (op != null && !op.isEmpty()) return op.toUpperCase();

        // Try parsing from db.statement
        String stmt = tags.get("db.statement");
        if (stmt == null) stmt = tags.get("db.query.text");
        if (stmt != null) {
            Matcher m = SQL_OPERATION_PATTERN.matcher(stmt);
            if (m.find()) return m.group(1).toUpperCase();
        }

        // Fall back to span operation name
        if (spanOperationName != null && !spanOperationName.isEmpty()) {
            Matcher m = SQL_OPERATION_PATTERN.matcher(spanOperationName);
            if (m.find()) return m.group(1).toUpperCase();
            return spanOperationName;
        }

        return "UNKNOWN";
    }

    private String resolveDbName(Map<String, String> tags) {
        for (String key : List.of("db.name", "db.namespace")) {
            String val = tags.get(key);
            if (val != null && !val.isEmpty()) return val;
        }
        return null;
    }

    private String resolveTable(Map<String, String> tags) {
        for (String key : List.of("db.sql.table", "db.collection.name",
                "db.cassandra.table", "db.mongodb.collection")) {
            String val = tags.get(key);
            if (val != null && !val.isEmpty()) return val;
        }

        // Try parsing table from db.statement
        String stmt = tags.get("db.statement");
        if (stmt == null) stmt = tags.get("db.query.text");
        if (stmt != null) {
            Matcher m = SQL_TABLE_PATTERN.matcher(stmt);
            if (m.find()) return m.group(1);
        }
        return null;
    }

    /**
     * Build collection label as {db.name}.{table} format.
     * Falls back to just table, just db.name, or db.system.
     */
    private String buildCollectionLabel(String dbName, String table, Map<String, String> tags) {
        if (dbName != null && table != null) return dbName + "." + table;
        if (table != null) return table;
        if (dbName != null) return dbName;
        return tags.getOrDefault("db.system", "unknown");
    }

    // ── Aggregation ─────────────────────────────────────────────────────────────

    private List<QueryMetricsResponse.QuerySummary> buildQuerySummaries(List<DbSpanData> spans, long rangeSecs) {
        // Group by operation|collection
        Map<String, List<DbSpanData>> groups = new LinkedHashMap<>();
        for (DbSpanData s : spans) {
            groups.computeIfAbsent(s.operation + "|" + s.collection, k -> new ArrayList<>()).add(s);
        }

        List<QueryMetricsResponse.QuerySummary> summaries = new ArrayList<>();
        for (var entry : groups.entrySet()) {
            String[] parts = entry.getKey().split("\\|", 2);
            List<DbSpanData> group = entry.getValue();

            List<Double> durations = group.stream().map(s -> s.durationSeconds).sorted().toList();
            double avg = durations.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
            double p95 = percentile(durations, 0.95);
            double callRate = (double) group.size() / rangeSecs;

            // Pick dbName from first span, and most common statement
            String dbName = group.stream().map(s -> s.dbName).filter(Objects::nonNull).findFirst().orElse(null);
            String statement = group.stream().map(s -> s.statement).filter(Objects::nonNull).findFirst().orElse(null);

            summaries.add(QueryMetricsResponse.QuerySummary.builder()
                    .operation(parts[0])
                    .collection(parts.length > 1 ? parts[1] : "unknown")
                    .dbName(dbName)
                    .statement(statement)
                    .avgExecTime(avg)
                    .p95ExecTime(p95)
                    .callCount(callRate)
                    .slowQuery(p95 > config.getSlowQueryThresholdSeconds())
                    .build());
        }

        // Sort by total call count descending
        summaries.sort((a, b) -> Double.compare(b.getCallCount(), a.getCallCount()));
        return summaries;
    }

    // ── Time-series construction ────────────────────────────────────────────────

    private TimeSeries buildOverallPercentileTimeSeries(List<DbSpanData> spans,
                                                         long startEpoch, long endEpoch,
                                                         long stepSeconds, double percentileVal,
                                                         String name) {
        List<MetricDataPoint> points = new ArrayList<>();
        for (long t = startEpoch; t < endEpoch; t += stepSeconds) {
            long bucketStart = t;
            long bucketEnd = t + stepSeconds;
            List<Double> durations = spans.stream()
                    .filter(s -> s.startTimeEpochSeconds >= bucketStart && s.startTimeEpochSeconds < bucketEnd)
                    .map(s -> s.durationSeconds)
                    .sorted()
                    .toList();
            double val = durations.isEmpty() ? 0.0 : percentile(durations, percentileVal);
            points.add(new MetricDataPoint(t, val));
        }
        return TimeSeries.builder().name(name).labels(Map.of()).dataPoints(points).build();
    }

    private TimeSeries buildQueryRateTimeSeries(List<DbSpanData> spans,
                                                  long startEpoch, long endEpoch, long stepSeconds) {
        List<MetricDataPoint> points = new ArrayList<>();
        for (long t = startEpoch; t < endEpoch; t += stepSeconds) {
            long bucketStart = t;
            long bucketEnd = t + stepSeconds;
            long count = spans.stream()
                    .filter(s -> s.startTimeEpochSeconds >= bucketStart && s.startTimeEpochSeconds < bucketEnd)
                    .count();
            points.add(new MetricDataPoint(t, (double) count / stepSeconds));
        }
        return TimeSeries.builder().name("query_rate").labels(Map.of()).dataPoints(points).build();
    }

    private List<TimeSeries> buildPerOperationTimeSeries(List<DbSpanData> spans,
                                                           long startEpoch, long endEpoch,
                                                           long stepSeconds) {
        // Group spans by operation name
        Map<String, List<DbSpanData>> byOp = spans.stream()
                .collect(Collectors.groupingBy(s -> s.operation, LinkedHashMap::new, Collectors.toList()));

        List<TimeSeries> result = new ArrayList<>();
        for (var entry : byOp.entrySet()) {
            List<MetricDataPoint> points = new ArrayList<>();
            for (long t = startEpoch; t < endEpoch; t += stepSeconds) {
                long bucketStart = t;
                long bucketEnd = t + stepSeconds;
                List<Double> durations = entry.getValue().stream()
                        .filter(s -> s.startTimeEpochSeconds >= bucketStart && s.startTimeEpochSeconds < bucketEnd)
                        .map(s -> s.durationSeconds)
                        .sorted()
                        .toList();
                double val = durations.isEmpty() ? 0.0 : percentile(durations, 0.50);
                points.add(new MetricDataPoint(t, val));
            }
            result.add(TimeSeries.builder()
                    .name("db_latency")
                    .labels(Map.of("db_operation_name", entry.getKey()))
                    .dataPoints(points)
                    .build());
        }
        return result;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private double percentile(List<Double> sortedValues, double p) {
        if (sortedValues.isEmpty()) return 0.0;
        List<Double> sorted = sortedValues.stream().sorted().toList();
        int index = (int) Math.ceil(p * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(index, sorted.size() - 1)));
    }
}

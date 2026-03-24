package com.observability.apm.service;

import com.observability.apm.config.QueryMetricsProperties;
import com.observability.apm.dto.MetricDataPoint;
import com.observability.apm.dto.QueryMetricsResponse;
import com.observability.apm.dto.TimeSeries;
import com.observability.apm.prometheus.PromQLBuilder;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Prometheus-based query metrics provider.
 * Extracts DB operation metrics from Prometheus histogram data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PrometheusQueryMetricsProvider {

    private static final String SERVICE_LABEL = "job";

    private static final String[] DB_DURATION_CANDIDATES = {
            "db_client_operation_duration_seconds_bucket",
            "db_client_operation_duration_bucket",
            "db_client_connections_use_time_milliseconds_bucket",
    };
    private static final String[] DB_COUNT_CANDIDATES = {
            "db_client_operation_duration_seconds_count",
            "db_client_operation_duration_count",
            "db_client_connections_use_time_milliseconds_count",
    };
    private static final String[] OPERATION_LABEL_CANDIDATES = {
            "db_operation_name", "db_operation", "db_statement",
    };
    private static final String[] COLLECTION_LABEL_CANDIDATES = {
            "db_collection_name", "db_namespace", "db_name", "db_sql_table",
    };

    private final PrometheusClient prometheusClient;
    private final QueryMetricsProperties config;

    public QueryMetricsResponse getQueryMetrics(String serviceName, Instant start, Instant end,
                                                  long stepSeconds, String rateWindow) {
        List<String> executedQueries = new ArrayList<>();

        String dbDurationMetric = resolveMetric(serviceName, DB_DURATION_CANDIDATES, executedQueries);
        String dbCountMetric = resolveMetric(serviceName, DB_COUNT_CANDIDATES, executedQueries);
        String operationLabel = resolveLabel(serviceName, dbDurationMetric, OPERATION_LABEL_CANDIDATES, executedQueries);
        String collectionLabel = resolveLabel(serviceName, dbDurationMetric, COLLECTION_LABEL_CANDIDATES, executedQueries);

        if (dbDurationMetric == null || dbCountMetric == null) {
            return QueryMetricsResponse.builder()
                    .serviceName(serviceName)
                    .queries(List.of())
                    .current(QueryMetricsResponse.InstantQueryMetrics.builder().slowQueryCount(0).build())
                    .latencyByOperation(List.of())
                    .executedQueries(executedQueries)
                    .build();
        }

        if (operationLabel == null || collectionLabel == null) {
            List<String> discovered = discoverLabels(serviceName, dbDurationMetric, executedQueries);
            if (operationLabel == null) {
                operationLabel = discovered.stream()
                        .filter(l -> l.contains("operation") || l.contains("statement") || l.contains("method"))
                        .findFirst().orElse(null);
            }
            if (collectionLabel == null) {
                collectionLabel = discovered.stream()
                        .filter(l -> l.contains("collection") || l.contains("table") || l.contains("namespace")
                                || l.contains("db_name") || l.equals("db_system"))
                        .findFirst().orElse(null);
            }
        }

        TimeSeries avgLatency = queryDbLatencyPercentile(serviceName, dbDurationMetric, 0.50, rateWindow, start, end, stepSeconds, "db_latency_p50", executedQueries);
        TimeSeries p95Latency = queryDbLatencyPercentile(serviceName, dbDurationMetric, 0.95, rateWindow, start, end, stepSeconds, "db_latency_p95", executedQueries);
        TimeSeries queryRate = queryDbRate(serviceName, dbCountMetric, rateWindow, start, end, stepSeconds, executedQueries);

        List<TimeSeries> latencyByOp = operationLabel != null
                ? queryDbLatencyByOperation(serviceName, dbDurationMetric, operationLabel, 0.50, rateWindow, start, end, stepSeconds, executedQueries)
                : List.of();

        String effectiveOpLabel = operationLabel != null ? operationLabel : "db_operation_name";
        String effectiveCollLabel = collectionLabel != null ? collectionLabel : "db_collection_name";
        List<QueryMetricsResponse.QuerySummary> queries = buildQuerySummaries(serviceName,
                dbDurationMetric, dbCountMetric, effectiveOpLabel, effectiveCollLabel,
                operationLabel != null, collectionLabel != null, rateWindow, executedQueries);

        Double currentAvg = queryInstantDbLatency(serviceName, dbDurationMetric, 0.50, rateWindow, executedQueries);
        Double currentP95 = queryInstantDbLatency(serviceName, dbDurationMetric, 0.95, rateWindow, executedQueries);
        Double currentRate = queryInstantDbRate(serviceName, dbCountMetric, rateWindow, executedQueries);
        int slowCount = (int) queries.stream().filter(QueryMetricsResponse.QuerySummary::isSlowQuery).count();

        return QueryMetricsResponse.builder()
                .serviceName(serviceName)
                .queries(queries)
                .avgLatency(avgLatency)
                .p95Latency(p95Latency)
                .queryRate(queryRate)
                .latencyByOperation(latencyByOp)
                .current(QueryMetricsResponse.InstantQueryMetrics.builder()
                        .avgLatency(currentAvg).p95Latency(currentP95)
                        .queryRate(currentRate).slowQueryCount(slowCount).build())
                .executedQueries(executedQueries)
                .build();
    }

    // ── All private helpers below are moved from the original QueryMetricsService ──

    private String resolveMetric(String serviceName, String[] candidates, List<String> queryLog) {
        for (String metric : candidates) {
            String query = "count(" + PromQLBuilder.metric(metric).label(SERVICE_LABEL, serviceName).build() + ")";
            queryLog.add("[resolve] " + query);
            Double val = extractInstantValue(prometheusClient.query(query));
            if (val != null && val > 0) return metric;
        }
        return null;
    }

    private String resolveLabel(String serviceName, String metric, String[] candidates, List<String> queryLog) {
        if (metric == null) return null;
        for (String label : candidates) {
            String query = "count by(" + label + ")(" + PromQLBuilder.metric(metric).label(SERVICE_LABEL, serviceName).build() + ")";
            queryLog.add("[resolve] " + query);
            PrometheusResponse resp = prometheusClient.query(query);
            if (resp != null && resp.getData() != null && resp.getData().getResult() != null) {
                for (PrometheusResponse.PromResult result : resp.getData().getResult()) {
                    if (result.getMetric() != null && result.getMetric().containsKey(label) && !result.getMetric().get(label).isEmpty()) {
                        return label;
                    }
                }
            }
        }
        return null;
    }

    private List<String> discoverLabels(String serviceName, String metric, List<String> queryLog) {
        String query = PromQLBuilder.metric(metric).label(SERVICE_LABEL, serviceName).build();
        queryLog.add("[discover] " + query);
        PrometheusResponse resp = prometheusClient.query(query);
        if (resp == null || resp.getData() == null || resp.getData().getResult() == null || resp.getData().getResult().isEmpty()) return List.of();
        var skip = Set.of("__name__", "instance", "job", "le", "exported_job");
        return resp.getData().getResult().stream().map(PrometheusResponse.PromResult::getMetric).filter(m -> m != null)
                .flatMap(m -> m.keySet().stream()).filter(k -> !skip.contains(k)).distinct().sorted().toList();
    }

    private TimeSeries queryDbLatencyPercentile(String svc, String metric, double q, String rw, Instant s, Instant e, long step, String name, List<String> log) {
        String query = PromQLBuilder.metric(metric).label(SERVICE_LABEL, svc).rate(rw).sumBy("le").histogramQuantile(q).build();
        log.add(query);
        return TimeSeries.builder().name(name).labels(Map.of(SERVICE_LABEL, svc)).dataPoints(extractFirstSeries(prometheusClient.queryRange(query, s, e, step))).build();
    }

    private TimeSeries queryDbRate(String svc, String metric, String rw, Instant s, Instant e, long step, List<String> log) {
        String query = PromQLBuilder.metric(metric).label(SERVICE_LABEL, svc).rate(rw).sum().build();
        log.add(query);
        return TimeSeries.builder().name("query_rate").labels(Map.of(SERVICE_LABEL, svc)).dataPoints(extractFirstSeries(prometheusClient.queryRange(query, s, e, step))).build();
    }

    private List<TimeSeries> queryDbLatencyByOperation(String svc, String metric, String opLabel, double q, String rw, Instant s, Instant e, long step, List<String> log) {
        String query = PromQLBuilder.metric(metric).label(SERVICE_LABEL, svc).rate(rw).sumBy("le", opLabel).histogramQuantile(q).build();
        log.add(query);
        return extractMultiSeries(prometheusClient.queryRange(query, s, e, step), "db_latency");
    }

    private Double queryInstantDbLatency(String svc, String metric, double q, String rw, List<String> log) {
        String query = PromQLBuilder.metric(metric).label(SERVICE_LABEL, svc).rate(rw).sumBy("le").histogramQuantile(q).build();
        log.add(query);
        return extractInstantValue(prometheusClient.query(query));
    }

    private Double queryInstantDbRate(String svc, String metric, String rw, List<String> log) {
        String query = PromQLBuilder.metric(metric).label(SERVICE_LABEL, svc).rate(rw).sum().build();
        log.add(query);
        return extractInstantValue(prometheusClient.query(query));
    }

    private List<QueryMetricsResponse.QuerySummary> buildQuerySummaries(String svc, String durMetric, String cntMetric,
            String opLabel, String collLabel, boolean hasOp, boolean hasColl, String rw, List<String> log) {
        List<String> groupLabels = new ArrayList<>();
        groupLabels.add("le");
        if (hasOp) groupLabels.add(opLabel);
        if (hasColl) groupLabels.add(collLabel);
        List<String> countGroupLabels = new ArrayList<>(groupLabels);
        countGroupLabels.remove("le");

        String p50Q = PromQLBuilder.metric(durMetric).label(SERVICE_LABEL, svc).rate(rw).sumBy(groupLabels.toArray(String[]::new)).histogramQuantile(0.50).build();
        String p95Q = PromQLBuilder.metric(durMetric).label(SERVICE_LABEL, svc).rate(rw).sumBy(groupLabels.toArray(String[]::new)).histogramQuantile(0.95).build();
        log.add(p50Q); log.add(p95Q);

        PromQLBuilder cb = PromQLBuilder.metric(cntMetric).label(SERVICE_LABEL, svc).rate(rw);
        if (countGroupLabels.isEmpty()) cb.sum(); else cb.sumBy(countGroupLabels.toArray(String[]::new));
        String cntQ = cb.build();
        log.add(cntQ);

        PrometheusResponse p50R = prometheusClient.query(p50Q);
        Map<String, Double> p95Map = buildLabelValueMap(prometheusClient.query(p95Q), opLabel, collLabel);
        Map<String, Double> cntMap = buildLabelValueMap(prometheusClient.query(cntQ), opLabel, collLabel);

        List<QueryMetricsResponse.QuerySummary> summaries = new ArrayList<>();
        if (p50R != null && p50R.getData() != null && p50R.getData().getResult() != null) {
            for (PrometheusResponse.PromResult r : p50R.getData().getResult()) {
                Map<String, String> labels = r.getMetric() != null ? r.getMetric() : Map.of();
                String op = extractLabelValue(labels, opLabel, hasOp);
                String coll = extractLabelValue(labels, collLabel, hasColl);
                String key = op + "|" + coll;
                Double avg = parseInstantValue(r);
                Double p95 = p95Map.get(key);
                Double cnt = cntMap.get(key);
                summaries.add(QueryMetricsResponse.QuerySummary.builder()
                        .operation(op).collection(coll).avgExecTime(avg).p95ExecTime(p95).callCount(cnt)
                        .slowQuery(p95 != null && p95 > config.getSlowQueryThresholdSeconds()).build());
            }
        }
        return summaries;
    }

    private String extractLabelValue(Map<String, String> labels, String labelName, boolean wasResolved) {
        if (wasResolved) { String v = labels.get(labelName); return (v != null && !v.isEmpty()) ? v : "all"; }
        var skip = Set.of("__name__", "instance", "job", "le", "exported_job");
        for (var e : labels.entrySet()) { if (!skip.contains(e.getKey()) && e.getValue() != null && !e.getValue().isEmpty()) return e.getKey() + "=" + e.getValue(); }
        return "all";
    }

    private Map<String, Double> buildLabelValueMap(PrometheusResponse resp, String opLabel, String collLabel) {
        Map<String, Double> map = new HashMap<>();
        if (resp == null || resp.getData() == null || resp.getData().getResult() == null) return map;
        for (PrometheusResponse.PromResult r : resp.getData().getResult()) {
            Map<String, String> l = r.getMetric() != null ? r.getMetric() : Map.of();
            String op = l.getOrDefault(opLabel, "all"); if (op.isEmpty()) op = "all";
            String co = l.getOrDefault(collLabel, "all"); if (co.isEmpty()) co = "all";
            Double v = parseInstantValue(r);
            if (v != null) map.put(op + "|" + co, v);
        }
        return map;
    }

    private List<MetricDataPoint> extractFirstSeries(PrometheusResponse resp) {
        if (resp == null || resp.getData() == null || resp.getData().getResult() == null || resp.getData().getResult().isEmpty()) return Collections.emptyList();
        return parseDataPoints(resp.getData().getResult().getFirst());
    }

    private List<TimeSeries> extractMultiSeries(PrometheusResponse resp, String name) {
        if (resp == null || resp.getData() == null || resp.getData().getResult() == null) return Collections.emptyList();
        List<TimeSeries> list = new ArrayList<>();
        for (PrometheusResponse.PromResult r : resp.getData().getResult()) {
            list.add(TimeSeries.builder().name(name).labels(r.getMetric() != null ? r.getMetric() : Map.of()).dataPoints(parseDataPoints(r)).build());
        }
        return list;
    }

    private List<MetricDataPoint> parseDataPoints(PrometheusResponse.PromResult r) {
        if (r.getValues() == null) return Collections.emptyList();
        List<MetricDataPoint> pts = new ArrayList<>();
        for (List<Object> pair : r.getValues()) {
            if (pair.size() >= 2) { long ts = ((Number) pair.get(0)).longValue(); double v = parseDouble(pair.get(1)); if (!Double.isNaN(v)) pts.add(new MetricDataPoint(ts, v)); }
        }
        return pts;
    }

    private Double extractInstantValue(PrometheusResponse resp) {
        if (resp == null || resp.getData() == null || resp.getData().getResult() == null || resp.getData().getResult().isEmpty()) return null;
        return parseInstantValue(resp.getData().getResult().getFirst());
    }

    private Double parseInstantValue(PrometheusResponse.PromResult r) {
        if (r.getValue() != null && r.getValue().size() >= 2) { double v = parseDouble(r.getValue().get(1)); return Double.isNaN(v) ? null : v; }
        return null;
    }

    private double parseDouble(Object obj) { try { return Double.parseDouble(obj.toString()); } catch (NumberFormatException e) { return Double.NaN; } }
}

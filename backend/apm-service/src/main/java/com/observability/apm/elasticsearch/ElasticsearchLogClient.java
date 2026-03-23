package com.observability.apm.elasticsearch;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.SortOrder;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch._types.mapping.RuntimeField;
import co.elastic.clients.elasticsearch._types.mapping.RuntimeFieldType;
import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import com.fasterxml.jackson.databind.JsonNode;
import com.observability.apm.config.ElasticsearchProperties;
import com.observability.apm.dto.LogMetricsResponse;
import com.observability.apm.dto.LogSearchResponse;
import com.observability.apm.dto.MetricDataPoint;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Elasticsearch client for log-level metric aggregations (Story 6.3).
 * Queries the log index for pattern frequency and distinct pattern count.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ElasticsearchLogClient {

    // OTel log schema field names
    private static final String SERVICE_NAME_FIELD = "resource.attributes.service.name";
    private static final String SEVERITY_FIELD = "severity_text";
    private static final String BODY_TEXT_FIELD = "body.text";
    private static final String BODY_KEYWORD_RUNTIME = "body_keyword";
    private static final String BODY_KEYWORD_SCRIPT =
            "String v = params._source.body?.text; if (v != null) emit(v);";

    private final ElasticsearchClient esClient;
    private final ElasticsearchProperties esProperties;

    /**
     * Query top log patterns for a service within a time range.
     *
     * @param serviceName the service name to filter by
     * @param start       range start
     * @param end         range end
     * @param limit       max number of patterns to return
     * @return list of top log patterns with counts and percentages
     */
    public List<LogMetricsResponse.LogPattern> getTopPatterns(String serviceName, Instant start,
                                                               Instant end, int limit,
                                                               long stepSeconds) {
        try {
            Query query = buildServiceTimeQuery(serviceName, start, end);
            String histogramInterval = stepSeconds + "s";

            SearchResponse<Void> response = esClient.search(s -> s
                    .index(esProperties.getLogIndex())
                    .size(0)
                    .trackTotalHits(t -> t.enabled(true))
                    .runtimeMappings(BODY_KEYWORD_RUNTIME, RuntimeField.of(rf -> rf
                            .type(RuntimeFieldType.Keyword)
                            .script(sc -> sc.inline(i -> i.source(BODY_KEYWORD_SCRIPT)))))
                    .query(query)
                    .aggregations("by_pattern", a -> a
                            .terms(t -> t
                                    .field(BODY_KEYWORD_RUNTIME)
                                    .size(limit))
                            .aggregations("by_level", sa -> sa
                                    .terms(t -> t
                                            .field(SEVERITY_FIELD)
                                            .size(1)))
                            .aggregations("over_time", sa -> sa
                                    .dateHistogram(dh -> dh
                                            .field("@timestamp")
                                            .fixedInterval(fi -> fi.time(histogramInterval))))),
                    Void.class);

            long totalDocs = response.hits().total() != null ? response.hits().total().value() : 0;

            Aggregate byPatternAgg = response.aggregations().get("by_pattern");
            if (byPatternAgg == null || !byPatternAgg.isSterms()) {
                return List.of();
            }

            List<LogMetricsResponse.LogPattern> patterns = new ArrayList<>();
            for (StringTermsBucket bucket : byPatternAgg.sterms().buckets().array()) {
                String pattern = bucket.key().stringValue();
                long count = bucket.docCount();
                double pct = totalDocs > 0 ? (count * 100.0) / totalDocs : 0.0;

                // Get predominant severity level
                String level = "INFO";
                Aggregate levelAgg = bucket.aggregations().get("by_level");
                if (levelAgg != null && levelAgg.isSterms()
                        && !levelAgg.sterms().buckets().array().isEmpty()) {
                    level = levelAgg.sterms().buckets().array().getFirst().key().stringValue();
                }

                // Extract trend time series from date histogram
                List<MetricDataPoint> trendSeries = new ArrayList<>();
                Aggregate overTimeAgg = bucket.aggregations().get("over_time");
                if (overTimeAgg != null && overTimeAgg.isDateHistogram()) {
                    for (var timeBucket : overTimeAgg.dateHistogram().buckets().array()) {
                        long epochSeconds = timeBucket.key() / 1000;
                        trendSeries.add(new MetricDataPoint(epochSeconds, (double) timeBucket.docCount()));
                    }
                }

                patterns.add(LogMetricsResponse.LogPattern.builder()
                        .pattern(pattern)
                        .level(level)
                        .count(count)
                        .percentage(pct)
                        .trend(computeTrend(trendSeries))
                        .trendSeries(trendSeries)
                        .build());
            }

            return patterns;

        } catch (Exception ex) {
            log.error("Elasticsearch log pattern query failed for service [{}]: {}", serviceName, ex.getMessage());
            return List.of();
        }
    }

    /**
     * Compute trend direction by comparing first-half vs second-half averages.
     */
    private String computeTrend(List<MetricDataPoint> series) {
        if (series.size() < 2) return "stable";
        int mid = series.size() / 2;
        double firstHalfAvg = series.subList(0, mid).stream()
                .mapToDouble(MetricDataPoint::getValue).average().orElse(0);
        double secondHalfAvg = series.subList(mid, series.size()).stream()
                .mapToDouble(MetricDataPoint::getValue).average().orElse(0);
        if (firstHalfAvg == 0 && secondHalfAvg == 0) return "stable";
        if (firstHalfAvg == 0) return "up";
        double change = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
        if (change > 0.1) return "up";
        if (change < -0.1) return "down";
        return "stable";
    }

    /**
     * Count distinct log patterns for a service within a time range.
     */
    public int getDistinctPatternCount(String serviceName, Instant start, Instant end) {
        try {
            Query query = buildServiceTimeQuery(serviceName, start, end);

            SearchResponse<Void> response = esClient.search(s -> s
                    .index(esProperties.getLogIndex())
                    .size(0)
                    .runtimeMappings(BODY_KEYWORD_RUNTIME, RuntimeField.of(rf -> rf
                            .type(RuntimeFieldType.Keyword)
                            .script(sc -> sc.inline(i -> i.source(BODY_KEYWORD_SCRIPT)))))
                    .query(query)
                    .aggregations("distinct_patterns", a -> a
                            .cardinality(c -> c.field(BODY_KEYWORD_RUNTIME))),
                    Void.class);

            Aggregate agg = response.aggregations().get("distinct_patterns");
            if (agg != null && agg.isCardinality()) {
                return (int) agg.cardinality().value();
            }
            return 0;

        } catch (Exception ex) {
            log.error("Elasticsearch distinct pattern count failed for service [{}]: {}", serviceName, ex.getMessage());
            return 0;
        }
    }

    // ── Story 6.4 / 6.8 / 7.1: Log Search ──────────────────────────────────

    private static final String TRACE_ID_FIELD = "trace_id";

    /**
     * Search log entries with filters and pagination.
     *
     * @param serviceName service name filter (null = all services)
     * @param severities  severity levels to include (null/empty = all)
     * @param searchText  full-text search on body (null/blank = no text filter)
     * @param traceId     trace ID for trace-level log correlation (null = no filter)
     * @param start       range start
     * @param end         range end
     * @param from        pagination offset
     * @param size        page size
     * @return paginated log search response
     */
    public LogSearchResponse searchLogs(String serviceName, List<String> severities,
                                         String searchText, String traceId,
                                         Instant start, Instant end,
                                         int from, int size) {
        try {
            BoolQuery.Builder boolBuilder = new BoolQuery.Builder();

            // Time range filter (always applied)
            boolBuilder.must(m -> m.range(r -> r
                    .field("@timestamp")
                    .gte(JsonData.of(start.toString()))
                    .lte(JsonData.of(end.toString()))));

            // Service name filter
            if (serviceName != null && !serviceName.isBlank()) {
                boolBuilder.must(m -> m.term(t -> t
                        .field(SERVICE_NAME_FIELD)
                        .value(serviceName)));
            }

            // Severity filter
            if (severities != null && !severities.isEmpty()) {
                boolBuilder.must(m -> m.terms(t -> t
                        .field(SEVERITY_FIELD)
                        .terms(tv -> tv.value(severities.stream()
                                .map(s -> co.elastic.clients.elasticsearch._types.FieldValue.of(s))
                                .toList()))));
            }

            // Full-text search on log body
            if (searchText != null && !searchText.isBlank()) {
                boolBuilder.must(m -> m.matchPhrase(mp -> mp
                        .field(BODY_TEXT_FIELD)
                        .query(searchText)));
            }

            // Story 7.1: Trace-level log correlation
            if (traceId != null && !traceId.isBlank()) {
                boolBuilder.must(m -> m.term(t -> t
                        .field(TRACE_ID_FIELD)
                        .value(traceId)));
            }

            Query query = boolBuilder.build()._toQuery();

            SearchResponse<JsonNode> response = esClient.search(s -> s
                            .index(esProperties.getLogIndex())
                            .size(size)
                            .from(from)
                            .trackTotalHits(t -> t.enabled(true))
                            .sort(sort -> sort.field(f -> f.field("@timestamp").order(SortOrder.Desc)))
                            .query(query),
                    JsonNode.class);

            long totalHits = response.hits().total() != null ? response.hits().total().value() : 0;
            int totalPages = size > 0 ? (int) Math.ceil((double) totalHits / size) : 0;

            List<LogSearchResponse.LogEntry> entries = new ArrayList<>();
            for (Hit<JsonNode> hit : response.hits().hits()) {
                JsonNode source = hit.source();
                if (source == null) continue;
                entries.add(mapToLogEntry(source));
            }

            return LogSearchResponse.builder()
                    .totalHits(totalHits)
                    .page(size > 0 ? from / size : 0)
                    .size(size)
                    .totalPages(totalPages)
                    .entries(entries)
                    .build();

        } catch (Exception ex) {
            log.error("Elasticsearch log search failed: {}", ex.getMessage());
            return LogSearchResponse.builder()
                    .totalHits(0)
                    .page(0)
                    .size(size)
                    .totalPages(0)
                    .entries(List.of())
                    .build();
        }
    }

    /**
     * Map an Elasticsearch JSON document to a LogEntry DTO.
     */
    private LogSearchResponse.LogEntry mapToLogEntry(JsonNode source) {
        String timestamp = textOrNull(source, "@timestamp");
        String severity = textOrNull(source, "severity_text");
        String body = null;
        String traceId = textOrNull(source, "trace_id");
        String spanId = textOrNull(source, "span_id");
        String serviceName = null;

        // Extract body.text
        JsonNode bodyNode = source.path("body");
        if (bodyNode.has("text")) {
            body = bodyNode.get("text").asText();
        }

        // Extract resource.attributes.service.name
        JsonNode resourceAttrs = source.path("resource").path("attributes");
        if (resourceAttrs.has("service.name")) {
            serviceName = resourceAttrs.get("service.name").asText();
        }

        // Collect additional attributes
        Map<String, String> attributes = new HashMap<>();
        JsonNode logAttrs = source.path("attributes");
        if (logAttrs.isObject()) {
            logAttrs.fields().forEachRemaining(field ->
                    attributes.put(field.getKey(), field.getValue().asText()));
        }

        // Extract logger name: attributes.logger_name > attributes.code.namespace > logger_name (top-level)
        String loggerName = attributes.get("logger_name");
        if (loggerName == null) loggerName = attributes.get("code.namespace");
        if (loggerName == null) loggerName = textOrNull(source, "logger_name");

        // Extract line number: attributes.code.lineno > attributes.code.line_number
        Integer lineNumber = null;
        String lineStr = attributes.get("code.lineno");
        if (lineStr == null) lineStr = attributes.get("code.line_number");
        if (lineStr != null) {
            try { lineNumber = Integer.parseInt(lineStr); } catch (NumberFormatException ignored) {}
        }

        return LogSearchResponse.LogEntry.builder()
                .timestamp(timestamp)
                .severity(severity != null ? severity : "INFO")
                .serviceName(serviceName)
                .body(body)
                .loggerName(loggerName)
                .lineNumber(lineNumber)
                .traceId(traceId)
                .spanId(spanId)
                .attributes(attributes)
                .build();
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return (value != null && !value.isNull()) ? value.asText() : null;
    }

    // ── Story 7.4: Log Enrichment Validation ──────────────────────────────────

    /**
     * Count log records that have a specific field present (exists and non-null).
     *
     * @param serviceName service name filter
     * @param field       Elasticsearch field to check existence of
     * @param start       range start
     * @param end         range end
     * @return count of documents where the field exists
     */
    public long countLogsWithField(String serviceName, String field, Instant start, Instant end) {
        try {
            Query baseQuery = buildServiceTimeQuery(serviceName, start, end);

            BoolQuery.Builder boolBuilder = new BoolQuery.Builder()
                    .must(m -> m.bool(baseQuery.bool()))
                    .must(m -> m.exists(e -> e.field(field)));

            SearchResponse<Void> response = esClient.search(s -> s
                            .index(esProperties.getLogIndex())
                            .size(0)
                            .trackTotalHits(t -> t.enabled(true))
                            .query(boolBuilder.build()._toQuery()),
                    Void.class);

            return response.hits().total() != null ? response.hits().total().value() : 0;

        } catch (Exception ex) {
            log.error("Elasticsearch field existence check failed for field [{}]: {}", field, ex.getMessage());
            return 0;
        }
    }

    /**
     * Count total log records for a service within a time range.
     */
    public long countTotalLogs(String serviceName, Instant start, Instant end) {
        try {
            Query query = buildServiceTimeQuery(serviceName, start, end);

            SearchResponse<Void> response = esClient.search(s -> s
                            .index(esProperties.getLogIndex())
                            .size(0)
                            .trackTotalHits(t -> t.enabled(true))
                            .query(query),
                    Void.class);

            return response.hits().total() != null ? response.hits().total().value() : 0;

        } catch (Exception ex) {
            log.error("Elasticsearch total log count failed: {}", ex.getMessage());
            return 0;
        }
    }

    /**
     * Find sample log records that are missing one or more enrichment fields.
     *
     * @param serviceName service name
     * @param start       range start
     * @param end         range end
     * @param limit       max samples to return
     * @return log entries missing traceId, spanId, or service.name
     */
    public List<LogSearchResponse.LogEntry> findLogsMissingEnrichment(
            String serviceName, Instant start, Instant end, int limit) {
        try {
            Query baseQuery = buildServiceTimeQuery(serviceName, start, end);

            // Find logs missing at least one of: trace_id, span_id, resource.attributes.service.name
            BoolQuery.Builder missingAny = new BoolQuery.Builder()
                    .must(m -> m.bool(baseQuery.bool()))
                    .should(s -> s.bool(b -> b.mustNot(mn -> mn.exists(e -> e.field(TRACE_ID_FIELD)))))
                    .should(s -> s.bool(b -> b.mustNot(mn -> mn.exists(e -> e.field("span_id")))))
                    .should(s -> s.bool(b -> b.mustNot(mn -> mn.exists(e -> e.field(SERVICE_NAME_FIELD)))))
                    .minimumShouldMatch("1");

            SearchResponse<JsonNode> response = esClient.search(s -> s
                            .index(esProperties.getLogIndex())
                            .size(limit)
                            .trackTotalHits(t -> t.enabled(true))
                            .sort(sort -> sort.field(f -> f.field("@timestamp").order(SortOrder.Desc)))
                            .query(missingAny.build()._toQuery()),
                    JsonNode.class);

            List<LogSearchResponse.LogEntry> entries = new ArrayList<>();
            for (Hit<JsonNode> hit : response.hits().hits()) {
                JsonNode source = hit.source();
                if (source == null) continue;
                entries.add(mapToLogEntry(source));
            }
            return entries;

        } catch (Exception ex) {
            log.error("Elasticsearch missing enrichment query failed: {}", ex.getMessage());
            return List.of();
        }
    }

    // ── Story 10.3: Severity-filtered log count (for log-based SLA rules) ────

    /**
     * Count log records matching specific severity levels within a time range.
     *
     * @param serviceName service name filter
     * @param severities  list of severity levels (e.g. ["ERROR", "FATAL"])
     * @param start       range start
     * @param end         range end
     * @return count of matching documents
     */
    public long countLogsWithSeverity(String serviceName, List<String> severities,
                                       Instant start, Instant end) {
        try {
            BoolQuery.Builder boolBuilder = new BoolQuery.Builder()
                    .must(m -> m.term(t -> t.field(SERVICE_NAME_FIELD).value(serviceName)))
                    .must(m -> m.range(r -> r
                            .field("@timestamp")
                            .gte(JsonData.of(start.toString()))
                            .lte(JsonData.of(end.toString()))));

            if (severities != null && !severities.isEmpty()) {
                boolBuilder.must(m -> m.terms(t -> t
                        .field(SEVERITY_FIELD)
                        .terms(tv -> tv.value(severities.stream()
                                .map(co.elastic.clients.elasticsearch._types.FieldValue::of)
                                .toList()))));
            }

            SearchResponse<Void> response = esClient.search(s -> s
                            .index(esProperties.getLogIndex())
                            .size(0)
                            .trackTotalHits(t -> t.enabled(true))
                            .query(boolBuilder.build()._toQuery()),
                    Void.class);

            return response.hits().total() != null ? response.hits().total().value() : 0;

        } catch (Exception ex) {
            log.error("Elasticsearch severity count failed for service [{}]: {}", serviceName, ex.getMessage());
            return 0;
        }
    }

    // ── Shared query builders ─────────────────────────────────────────────────

    private Query buildServiceTimeQuery(String serviceName, Instant start, Instant end) {
        return new BoolQuery.Builder()
                .must(m -> m.term(t -> t.field(SERVICE_NAME_FIELD).value(serviceName)))
                .must(m -> m.range(r -> r
                        .field("@timestamp")
                        .gte(JsonData.of(start.toString()))
                        .lte(JsonData.of(end.toString()))))
                .build()
                ._toQuery();
    }
}

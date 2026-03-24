package com.observability.apm.service;

import com.observability.apm.dto.MetricDataPoint;
import com.observability.apm.dto.QueryMetricsResponse;
import com.observability.apm.dto.TimeSeries;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.prometheus.PromQLBuilder;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Story 6.2 — Query-level metrics service.
 * Queries OTel DB instrumentation metrics from Prometheus.
 *
 * <p>Tries multiple metric name conventions to handle different OTel SDK versions:
 * <ul>
 *   <li>OTel stable: {@code db_client_operation_duration_seconds}</li>
 *   <li>OTel legacy: {@code db_client_connections_usage}, {@code db_client_connections_use_time}</li>
 * </ul>
 *
 * <p>Also tries multiple label names for operation/collection:
 * <ul>
 *   <li>{@code db_operation_name} / {@code db_collection_name} (OTel 2.x+)</li>
 *   <li>{@code db_operation} / {@code db_name} (OTel 1.x / legacy)</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QueryMetricsService {

    private static final String SERVICE_LABEL = "job";
    private static final double DEFAULT_SLOW_QUERY_THRESHOLD = 0.5;

    // Metric name candidates (tried in order until one returns data)
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

    // Label name candidates for operation
    private static final String[] OPERATION_LABEL_CANDIDATES = {
            "db_operation_name",
            "db_operation",
            "db_statement",
    };

    // Label name candidates for collection/table
    private static final String[] COLLECTION_LABEL_CANDIDATES = {
            "db_collection_name",
            "db_namespace",
            "db_name",
            "db_sql_table",
    };

    private final PrometheusClient prometheusClient;
    private final ServiceRepository serviceRepository;

    /**
     * Fetch query-level metrics: per-operation SQL execution time, call counts,
     * and slow-query flags from OTel DB instrumentation metrics.
     */
    public QueryMetricsResponse getQueryMetrics(UUID serviceId, Instant start, Instant end,
                                                  long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();
        List<String> executedQueries = new ArrayList<>();

        // Resolve which metric names and labels actually exist in Prometheus
        String dbDurationMetric = resolveMetric(serviceName, DB_DURATION_CANDIDATES, executedQueries);
        String dbCountMetric = resolveMetric(serviceName, DB_COUNT_CANDIDATES, executedQueries);
        String operationLabel = resolveLabel(serviceName, dbDurationMetric, OPERATION_LABEL_CANDIDATES, executedQueries);
        String collectionLabel = resolveLabel(serviceName, dbDurationMetric, COLLECTION_LABEL_CANDIDATES, executedQueries);

        if (dbDurationMetric == null || dbCountMetric == null) {
            log.debug("No DB metrics found for service {} — tried: {}", serviceName,
                    String.join(", ", DB_DURATION_CANDIDATES));
            return QueryMetricsResponse.builder()
                    .serviceName(serviceName)
                    .queries(List.of())
                    .current(QueryMetricsResponse.InstantQueryMetrics.builder()
                            .slowQueryCount(0).build())
                    .latencyByOperation(List.of())
                    .executedQueries(executedQueries)
                    .build();
        }

        // Use defaults if labels not resolved
        if (operationLabel == null) operationLabel = "db_operation_name";
        if (collectionLabel == null) collectionLabel = "db_collection_name";

        // Overall DB latency time-series
        TimeSeries avgLatency = queryDbLatencyPercentile(serviceName, dbDurationMetric, 0.50,
                rateWindow, start, end, stepSeconds, "db_latency_p50", executedQueries);
        TimeSeries p95Latency = queryDbLatencyPercentile(serviceName, dbDurationMetric, 0.95,
                rateWindow, start, end, stepSeconds, "db_latency_p95", executedQueries);

        // Overall query rate time-series
        TimeSeries queryRate = queryDbRate(serviceName, dbCountMetric, rateWindow,
                start, end, stepSeconds, executedQueries);

        // Per-operation latency time-series
        List<TimeSeries> latencyByOp = queryDbLatencyByOperation(serviceName, dbDurationMetric,
                operationLabel, 0.50, rateWindow, start, end, stepSeconds, executedQueries);

        // Per-operation summaries (instant queries)
        List<QueryMetricsResponse.QuerySummary> queries = buildQuerySummaries(serviceName,
                dbDurationMetric, dbCountMetric, operationLabel, collectionLabel,
                rateWindow, executedQueries);

        // Current instant values
        Double currentAvg = queryInstantDbLatency(serviceName, dbDurationMetric, 0.50,
                rateWindow, executedQueries);
        Double currentP95 = queryInstantDbLatency(serviceName, dbDurationMetric, 0.95,
                rateWindow, executedQueries);
        Double currentRate = queryInstantDbRate(serviceName, dbCountMetric,
                rateWindow, executedQueries);
        int slowCount = (int) queries.stream()
                .filter(QueryMetricsResponse.QuerySummary::isSlowQuery).count();

        QueryMetricsResponse.InstantQueryMetrics current =
                QueryMetricsResponse.InstantQueryMetrics.builder()
                        .avgLatency(currentAvg)
                        .p95Latency(currentP95)
                        .queryRate(currentRate)
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
                .executedQueries(executedQueries)
                .build();
    }

    // ── Metric / label resolution ────────────────────────────────────────────────

    /**
     * Try each metric name candidate until one returns data from Prometheus.
     */
    private String resolveMetric(String serviceName, String[] candidates, List<String> queryLog) {
        for (String metric : candidates) {
            String query = "count(" + PromQLBuilder.metric(metric)
                    .label(SERVICE_LABEL, serviceName)
                    .build() + ")";
            queryLog.add("[resolve] " + query);

            PrometheusResponse resp = prometheusClient.query(query);
            Double val = extractInstantValue(resp);
            if (val != null && val > 0) {
                log.debug("Resolved DB metric: {} for service {}", metric, serviceName);
                return metric;
            }
        }
        return null;
    }

    /**
     * Try each label name candidate until one is found in the metric's labels.
     */
    private String resolveLabel(String serviceName, String metric, String[] candidates,
                                 List<String> queryLog) {
        if (metric == null) return null;

        for (String label : candidates) {
            String query = "count by(" + label + ")(" +
                    PromQLBuilder.metric(metric)
                            .label(SERVICE_LABEL, serviceName)
                            .build() + ")";
            queryLog.add("[resolve] " + query);

            PrometheusResponse resp = prometheusClient.query(query);
            if (resp != null && resp.getData() != null
                    && resp.getData().getResult() != null
                    && !resp.getData().getResult().isEmpty()) {
                // Check if the label is actually present (not empty)
                for (PrometheusResponse.PromResult result : resp.getData().getResult()) {
                    if (result.getMetric() != null && result.getMetric().containsKey(label)
                            && !result.getMetric().get(label).isEmpty()) {
                        log.debug("Resolved DB label: {} for service {}", label, serviceName);
                        return label;
                    }
                }
            }
        }
        return null;
    }

    // ── PromQL helpers ───────────────────────────────────────────────────────────

    private TimeSeries queryDbLatencyPercentile(String serviceName, String metric,
                                                 double quantile, String rateWindow,
                                                 Instant start, Instant end,
                                                 long stepSeconds, String seriesName,
                                                 List<String> queryLog) {
        String query = PromQLBuilder.metric(metric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();
        queryLog.add(query);

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name(seriesName)
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryDbRate(String serviceName, String metric, String rateWindow,
                                    Instant start, Instant end, long stepSeconds,
                                    List<String> queryLog) {
        String query = PromQLBuilder.metric(metric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();
        queryLog.add(query);

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("query_rate")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private List<TimeSeries> queryDbLatencyByOperation(String serviceName, String metric,
                                                         String operationLabel, double quantile,
                                                         String rateWindow, Instant start,
                                                         Instant end, long stepSeconds,
                                                         List<String> queryLog) {
        String query = PromQLBuilder.metric(metric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le", operationLabel)
                .histogramQuantile(quantile)
                .build();
        queryLog.add(query);

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return extractMultiSeries(response, "db_latency");
    }

    private Double queryInstantDbLatency(String serviceName, String metric, double quantile,
                                          String rateWindow, List<String> queryLog) {
        String query = PromQLBuilder.metric(metric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();
        queryLog.add(query);

        return extractInstantValue(prometheusClient.query(query));
    }

    private Double queryInstantDbRate(String serviceName, String metric, String rateWindow,
                                       List<String> queryLog) {
        String query = PromQLBuilder.metric(metric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();
        queryLog.add(query);

        return extractInstantValue(prometheusClient.query(query));
    }

    private List<QueryMetricsResponse.QuerySummary> buildQuerySummaries(
            String serviceName, String durationMetric, String countMetric,
            String operationLabel, String collectionLabel,
            String rateWindow, List<String> queryLog) {

        String p50Query = PromQLBuilder.metric(durationMetric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le", operationLabel, collectionLabel)
                .histogramQuantile(0.50)
                .build();
        queryLog.add(p50Query);

        String p95Query = PromQLBuilder.metric(durationMetric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le", operationLabel, collectionLabel)
                .histogramQuantile(0.95)
                .build();
        queryLog.add(p95Query);

        String countQuery = PromQLBuilder.metric(countMetric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy(operationLabel, collectionLabel)
                .build();
        queryLog.add(countQuery);

        PrometheusResponse p50Resp = prometheusClient.query(p50Query);
        PrometheusResponse p95Resp = prometheusClient.query(p95Query);
        PrometheusResponse countResp = prometheusClient.query(countQuery);

        Map<String, Double> p95Map = buildLabelValueMap(p95Resp, operationLabel, collectionLabel);
        Map<String, Double> countMap = buildLabelValueMap(countResp, operationLabel, collectionLabel);

        List<QueryMetricsResponse.QuerySummary> summaries = new ArrayList<>();
        if (p50Resp != null && p50Resp.getData() != null && p50Resp.getData().getResult() != null) {
            for (PrometheusResponse.PromResult result : p50Resp.getData().getResult()) {
                Map<String, String> labels = result.getMetric();
                if (labels == null) continue;

                String operation = labels.getOrDefault(operationLabel, "unknown");
                String collection = labels.getOrDefault(collectionLabel, "unknown");
                String key = operation + "|" + collection;

                Double avgExec = parseInstantValue(result);
                Double p95Exec = p95Map.get(key);
                Double count = countMap.get(key);
                boolean slow = p95Exec != null && p95Exec > DEFAULT_SLOW_QUERY_THRESHOLD;

                summaries.add(QueryMetricsResponse.QuerySummary.builder()
                        .operation(operation)
                        .collection(collection)
                        .avgExecTime(avgExec)
                        .p95ExecTime(p95Exec)
                        .callCount(count)
                        .slowQuery(slow)
                        .build());
            }
        }

        return summaries;
    }

    private Map<String, Double> buildLabelValueMap(PrometheusResponse response,
                                                     String operationLabel,
                                                     String collectionLabel) {
        Map<String, Double> map = new HashMap<>();
        if (response == null || response.getData() == null || response.getData().getResult() == null) {
            return map;
        }
        for (PrometheusResponse.PromResult result : response.getData().getResult()) {
            Map<String, String> labels = result.getMetric();
            if (labels == null) continue;
            String key = labels.getOrDefault(operationLabel, "unknown")
                    + "|" + labels.getOrDefault(collectionLabel, "unknown");
            Double val = parseInstantValue(result);
            if (val != null) map.put(key, val);
        }
        return map;
    }

    // ── Response parsing helpers ─────────────────────────────────────────────────

    private List<MetricDataPoint> extractFirstSeries(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return Collections.emptyList();
        }
        return parseDataPoints(response.getData().getResult().getFirst());
    }

    private List<TimeSeries> extractMultiSeries(PrometheusResponse response, String seriesName) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null) {
            return Collections.emptyList();
        }
        List<TimeSeries> seriesList = new ArrayList<>();
        for (PrometheusResponse.PromResult result : response.getData().getResult()) {
            seriesList.add(TimeSeries.builder()
                    .name(seriesName)
                    .labels(result.getMetric() != null ? result.getMetric() : Map.of())
                    .dataPoints(parseDataPoints(result))
                    .build());
        }
        return seriesList;
    }

    private List<MetricDataPoint> parseDataPoints(PrometheusResponse.PromResult result) {
        if (result.getValues() == null) return Collections.emptyList();
        List<MetricDataPoint> points = new ArrayList<>();
        for (List<Object> pair : result.getValues()) {
            if (pair.size() >= 2) {
                long ts = ((Number) pair.get(0)).longValue();
                double val = parseDouble(pair.get(1));
                if (!Double.isNaN(val)) points.add(new MetricDataPoint(ts, val));
            }
        }
        return points;
    }

    private Double extractInstantValue(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return null;
        }
        return parseInstantValue(response.getData().getResult().getFirst());
    }

    private Double parseInstantValue(PrometheusResponse.PromResult result) {
        if (result.getValue() != null && result.getValue().size() >= 2) {
            double val = parseDouble(result.getValue().get(1));
            return Double.isNaN(val) ? null : val;
        }
        return null;
    }

    private double parseDouble(Object obj) {
        try { return Double.parseDouble(obj.toString()); }
        catch (NumberFormatException e) { return Double.NaN; }
    }
}

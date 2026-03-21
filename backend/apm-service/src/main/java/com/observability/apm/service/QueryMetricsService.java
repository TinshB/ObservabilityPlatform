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
 * Queries OTel JDBC instrumentation metrics from Prometheus:
 * per-operation SQL execution time, call counts, and slow-query flags.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QueryMetricsService {

    private static final String SERVICE_LABEL = "job";
    private static final String DB_DURATION_METRIC = "db_client_operation_duration_seconds_bucket";
    private static final String DB_COUNT_METRIC = "db_client_operation_duration_seconds_count";
    private static final String DB_OPERATION_LABEL = "db_operation_name";
    private static final String DB_COLLECTION_LABEL = "db_collection_name";
    private static final double DEFAULT_SLOW_QUERY_THRESHOLD = 0.5;

    private final PrometheusClient prometheusClient;
    private final ServiceRepository serviceRepository;

    /**
     * Fetch query-level metrics: per-operation SQL execution time, call counts,
     * and slow-query flags from OTel JDBC instrumentation metrics.
     */
    public QueryMetricsResponse getQueryMetrics(UUID serviceId, Instant start, Instant end,
                                                  long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();

        // Overall DB latency time-series
        TimeSeries avgLatency = queryDbLatencyPercentile(serviceName, 0.50, rateWindow, start, end, stepSeconds, "db_latency_p50");
        TimeSeries p95Latency = queryDbLatencyPercentile(serviceName, 0.95, rateWindow, start, end, stepSeconds, "db_latency_p95");

        // Overall query rate time-series
        TimeSeries queryRate = queryDbRate(serviceName, rateWindow, start, end, stepSeconds);

        // Per-operation latency time-series
        List<TimeSeries> latencyByOp = queryDbLatencyByOperation(serviceName, 0.50, rateWindow, start, end, stepSeconds);

        // Per-operation summaries (instant queries)
        List<QueryMetricsResponse.QuerySummary> queries = buildQuerySummaries(serviceName, rateWindow);

        // Current instant values
        Double currentAvg = queryInstantDbLatency(serviceName, 0.50, rateWindow);
        Double currentP95 = queryInstantDbLatency(serviceName, 0.95, rateWindow);
        Double currentRate = queryInstantDbRate(serviceName, rateWindow);
        int slowCount = (int) queries.stream().filter(QueryMetricsResponse.QuerySummary::isSlowQuery).count();

        QueryMetricsResponse.InstantQueryMetrics current = QueryMetricsResponse.InstantQueryMetrics.builder()
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
                .build();
    }

    // ── PromQL helpers ───────────────────────────────────────────────────────

    private TimeSeries queryDbLatencyPercentile(String serviceName, double quantile,
                                                 String rateWindow, Instant start, Instant end,
                                                 long stepSeconds, String seriesName) {
        String query = PromQLBuilder.metric(DB_DURATION_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name(seriesName)
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryDbRate(String serviceName, String rateWindow,
                                    Instant start, Instant end, long stepSeconds) {
        String query = PromQLBuilder.metric(DB_COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("query_rate")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private List<TimeSeries> queryDbLatencyByOperation(String serviceName, double quantile,
                                                         String rateWindow, Instant start, Instant end,
                                                         long stepSeconds) {
        String query = PromQLBuilder.metric(DB_DURATION_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le", DB_OPERATION_LABEL)
                .histogramQuantile(quantile)
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return extractMultiSeries(response, "db_latency");
    }

    private Double queryInstantDbLatency(String serviceName, double quantile, String rateWindow) {
        String query = PromQLBuilder.metric(DB_DURATION_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();

        return extractInstantValue(prometheusClient.query(query));
    }

    private Double queryInstantDbRate(String serviceName, String rateWindow) {
        String query = PromQLBuilder.metric(DB_COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        return extractInstantValue(prometheusClient.query(query));
    }

    private List<QueryMetricsResponse.QuerySummary> buildQuerySummaries(String serviceName,
                                                                          String rateWindow) {
        String p50Query = PromQLBuilder.metric(DB_DURATION_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le", DB_OPERATION_LABEL, DB_COLLECTION_LABEL)
                .histogramQuantile(0.50)
                .build();

        String p95Query = PromQLBuilder.metric(DB_DURATION_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le", DB_OPERATION_LABEL, DB_COLLECTION_LABEL)
                .histogramQuantile(0.95)
                .build();

        String countQuery = PromQLBuilder.metric(DB_COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy(DB_OPERATION_LABEL, DB_COLLECTION_LABEL)
                .build();

        PrometheusResponse p50Resp = prometheusClient.query(p50Query);
        PrometheusResponse p95Resp = prometheusClient.query(p95Query);
        PrometheusResponse countResp = prometheusClient.query(countQuery);

        Map<String, Double> p95Map = buildLabelValueMap(p95Resp);
        Map<String, Double> countMap = buildLabelValueMap(countResp);

        List<QueryMetricsResponse.QuerySummary> summaries = new ArrayList<>();
        if (p50Resp != null && p50Resp.getData() != null && p50Resp.getData().getResult() != null) {
            for (PrometheusResponse.PromResult result : p50Resp.getData().getResult()) {
                Map<String, String> labels = result.getMetric();
                if (labels == null) continue;

                String operation = labels.getOrDefault(DB_OPERATION_LABEL, "unknown");
                String collection = labels.getOrDefault(DB_COLLECTION_LABEL, "unknown");
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

    private Map<String, Double> buildLabelValueMap(PrometheusResponse response) {
        Map<String, Double> map = new HashMap<>();
        if (response == null || response.getData() == null || response.getData().getResult() == null) {
            return map;
        }
        for (PrometheusResponse.PromResult result : response.getData().getResult()) {
            Map<String, String> labels = result.getMetric();
            if (labels == null) continue;
            String key = labels.getOrDefault(DB_OPERATION_LABEL, "unknown")
                    + "|" + labels.getOrDefault(DB_COLLECTION_LABEL, "unknown");
            Double val = parseInstantValue(result);
            if (val != null) map.put(key, val);
        }
        return map;
    }

    // ── Response parsing helpers ─────────────────────────────────────────────

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

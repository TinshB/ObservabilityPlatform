package com.observability.apm.service;

import com.observability.apm.dto.LogMetricsResponse;
import com.observability.apm.dto.MetricDataPoint;
import com.observability.apm.dto.TimeSeries;
import com.observability.apm.elasticsearch.ElasticsearchLogClient;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Story 6.3 — Log-level metrics service.
 * Queries Prometheus for log volume/error ratio time-series and
 * Elasticsearch for log pattern frequency analysis.
 *
 * <p>Expected Prometheus metric (exported by Micrometer Logback instrumentation):
 * <ul>
 *   <li>{@code logback_events_total} — counter with labels {@code job} and {@code level}</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LogMetricsService {

    private static final String LOG_METRIC = "logback_events_total";
    private static final String SERVICE_LABEL = "job";
    /** Prometheus label for severity in the PromQL query. */
    private static final String LEVEL_LABEL = "level";
    /** DTO label key used by the frontend to merge time-series. */
    private static final String SEVERITY_DTO_LABEL = "severity";
    private static final String[] SEVERITY_LEVELS = {"debug", "info", "warn", "error"};

    private final PrometheusClient prometheusClient;
    private final ElasticsearchLogClient esLogClient;
    private final ServiceRepository serviceRepository;

    /**
     * Fetch log-level metrics: volume by severity, error ratio, and top patterns.
     */
    public LogMetricsResponse getLogMetrics(UUID serviceId, Instant start, Instant end,
                                             long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();

        // Log volume by severity level
        List<TimeSeries> volumeByLevel = new ArrayList<>();
        for (String level : SEVERITY_LEVELS) {
            TimeSeries ts = queryLogVolume(serviceName, level, rateWindow, start, end, stepSeconds);
            volumeByLevel.add(ts);
        }

        // Total log volume
        TimeSeries totalVolume = queryTotalLogVolume(serviceName, rateWindow, start, end, stepSeconds);

        // Error ratio (ERROR + FATAL) / total
        TimeSeries errorRatio = queryErrorRatio(serviceName, rateWindow, start, end, stepSeconds);

        // Top patterns from Elasticsearch
        List<LogMetricsResponse.LogPattern> topPatterns = esLogClient.getTopPatterns(serviceName, start, end, 10, stepSeconds);

        // Instant values
        LogMetricsResponse.InstantLogMetrics current = buildInstantLogMetrics(serviceName, rateWindow, start, end);

        return LogMetricsResponse.builder()
                .serviceName(serviceName)
                .volumeByLevel(volumeByLevel)
                .totalVolume(totalVolume)
                .errorRatio(errorRatio)
                .topPatterns(topPatterns)
                .current(current)
                .build();
    }

    // ── Prometheus queries ───────────────────────────────────────────────────

    private TimeSeries queryLogVolume(String serviceName, String level, String rateWindow,
                                       Instant start, Instant end, long stepSeconds) {
        String query = PromQLBuilder.metric(LOG_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .label(LEVEL_LABEL, level)
                .rate(rateWindow)
                .sum()
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        List<MetricDataPoint> points = extractFirstSeries(response);

        String displayLevel = level.toUpperCase();
        return TimeSeries.builder()
                .name(displayLevel)
                .labels(Map.of(SERVICE_LABEL, serviceName, SEVERITY_DTO_LABEL, displayLevel))
                .dataPoints(points)
                .build();
    }

    private TimeSeries queryTotalLogVolume(String serviceName, String rateWindow,
                                            Instant start, Instant end, long stepSeconds) {
        String query = PromQLBuilder.metric(LOG_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        List<MetricDataPoint> points = extractFirstSeries(response);

        return TimeSeries.builder()
                .name("total_volume")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(points)
                .build();
    }

    private TimeSeries queryErrorRatio(String serviceName, String rateWindow,
                                        Instant start, Instant end, long stepSeconds) {
        // rate(errors) / rate(total)
        String errors = PromQLBuilder.metric(LOG_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .label(LEVEL_LABEL, "=~", "error|fatal")
                .rate(rateWindow)
                .sum()
                .build();

        String total = PromQLBuilder.metric(LOG_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        String query = errors + " / " + total;

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        List<MetricDataPoint> points = extractFirstSeries(response);

        return TimeSeries.builder()
                .name("error_ratio")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(points)
                .build();
    }

    private LogMetricsResponse.InstantLogMetrics buildInstantLogMetrics(
            String serviceName, String rateWindow, Instant start, Instant end) {
        String totalQuery = PromQLBuilder.metric(LOG_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        String errorQuery = PromQLBuilder.metric(LOG_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .label(LEVEL_LABEL, "=~", "error|fatal")
                .rate(rateWindow)
                .sum()
                .build();

        Double totalVol = extractInstantValue(prometheusClient.query(totalQuery));
        Double errorVol = extractInstantValue(prometheusClient.query(errorQuery));

        Double errorRatio = null;
        if (totalVol != null && totalVol > 0 && errorVol != null) {
            errorRatio = errorVol / totalVol;
        }

        int distinctPatterns = esLogClient.getDistinctPatternCount(serviceName, start, end);

        return LogMetricsResponse.InstantLogMetrics.builder()
                .totalVolume(totalVol)
                .errorVolume(errorVol)
                .errorRatio(errorRatio)
                .distinctPatterns(distinctPatterns)
                .build();
    }

    // ── Response parsing helpers (mirroring MetricsService) ─────────────────

    private List<MetricDataPoint> extractFirstSeries(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return Collections.emptyList();
        }

        PrometheusResponse.PromResult first = response.getData().getResult().getFirst();
        return parseDataPoints(first);
    }

    private List<MetricDataPoint> parseDataPoints(PrometheusResponse.PromResult result) {
        if (result.getValues() == null) {
            return Collections.emptyList();
        }

        List<MetricDataPoint> points = new ArrayList<>();
        for (List<Object> pair : result.getValues()) {
            if (pair.size() >= 2) {
                long ts = ((Number) pair.get(0)).longValue();
                double val = parseDouble(pair.get(1));
                if (!Double.isNaN(val)) {
                    points.add(new MetricDataPoint(ts, val));
                }
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
        PrometheusResponse.PromResult result = response.getData().getResult().getFirst();
        if (result.getValue() != null && result.getValue().size() >= 2) {
            double val = parseDouble(result.getValue().get(1));
            return Double.isNaN(val) ? null : val;
        }
        return null;
    }

    private double parseDouble(Object obj) {
        try {
            return Double.parseDouble(obj.toString());
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }
}

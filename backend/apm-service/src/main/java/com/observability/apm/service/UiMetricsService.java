package com.observability.apm.service;

import com.observability.apm.dto.MetricDataPoint;
import com.observability.apm.dto.TimeSeries;
import com.observability.apm.dto.UiMetricsResponse;
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
 * Story 6.1 — UI-level (Web Vitals) metrics service.
 * Queries OTel Browser SDK histogram metrics from Prometheus:
 * FCP, LCP, CLS, TTI percentiles with Google CWV threshold status.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UiMetricsService {

    private static final String SERVICE_LABEL = "job";

    // OTel Browser SDK metric names
    private static final String FCP_METRIC = "browser_web_vital_fcp_seconds_bucket";
    private static final String LCP_METRIC = "browser_web_vital_lcp_seconds_bucket";
    private static final String CLS_METRIC = "browser_web_vital_cls_bucket";
    private static final String TTI_METRIC = "browser_web_vital_tti_seconds_bucket";

    // Google CWV thresholds
    private static final double FCP_GOOD = 1.8;
    private static final double FCP_POOR = 3.0;
    private static final double LCP_GOOD = 2.5;
    private static final double LCP_POOR = 4.0;
    private static final double CLS_GOOD = 0.1;
    private static final double CLS_POOR = 0.25;
    private static final double TTI_GOOD = 3.8;
    private static final double TTI_POOR = 7.3;

    private final PrometheusClient prometheusClient;
    private final ServiceRepository serviceRepository;

    /**
     * Fetch UI-level (Web Vitals) metrics: FCP, LCP, CLS, TTI percentiles.
     */
    public UiMetricsResponse getUiMetrics(UUID serviceId, Instant start, Instant end,
                                            long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();

        // FCP percentiles
        TimeSeries fcpP50 = queryPercentile(serviceName, FCP_METRIC, 0.50, rateWindow, start, end, stepSeconds, "fcp_p50");
        TimeSeries fcpP75 = queryPercentile(serviceName, FCP_METRIC, 0.75, rateWindow, start, end, stepSeconds, "fcp_p75");
        TimeSeries fcpP95 = queryPercentile(serviceName, FCP_METRIC, 0.95, rateWindow, start, end, stepSeconds, "fcp_p95");

        // LCP percentiles
        TimeSeries lcpP50 = queryPercentile(serviceName, LCP_METRIC, 0.50, rateWindow, start, end, stepSeconds, "lcp_p50");
        TimeSeries lcpP75 = queryPercentile(serviceName, LCP_METRIC, 0.75, rateWindow, start, end, stepSeconds, "lcp_p75");
        TimeSeries lcpP95 = queryPercentile(serviceName, LCP_METRIC, 0.95, rateWindow, start, end, stepSeconds, "lcp_p95");

        // CLS percentiles
        TimeSeries clsP50 = queryPercentile(serviceName, CLS_METRIC, 0.50, rateWindow, start, end, stepSeconds, "cls_p50");
        TimeSeries clsP75 = queryPercentile(serviceName, CLS_METRIC, 0.75, rateWindow, start, end, stepSeconds, "cls_p75");
        TimeSeries clsP95 = queryPercentile(serviceName, CLS_METRIC, 0.95, rateWindow, start, end, stepSeconds, "cls_p95");

        // TTI percentiles
        TimeSeries ttiP50 = queryPercentile(serviceName, TTI_METRIC, 0.50, rateWindow, start, end, stepSeconds, "tti_p50");
        TimeSeries ttiP75 = queryPercentile(serviceName, TTI_METRIC, 0.75, rateWindow, start, end, stepSeconds, "tti_p75");
        TimeSeries ttiP95 = queryPercentile(serviceName, TTI_METRIC, 0.95, rateWindow, start, end, stepSeconds, "tti_p95");

        // Instant P75 values with status
        Double fcpVal = queryInstant(serviceName, FCP_METRIC, 0.75, rateWindow);
        Double lcpVal = queryInstant(serviceName, LCP_METRIC, 0.75, rateWindow);
        Double clsVal = queryInstant(serviceName, CLS_METRIC, 0.75, rateWindow);
        Double ttiVal = queryInstant(serviceName, TTI_METRIC, 0.75, rateWindow);

        UiMetricsResponse.InstantWebVitals current = UiMetricsResponse.InstantWebVitals.builder()
                .fcpP75(fcpVal).lcpP75(lcpVal).clsP75(clsVal).ttiP75(ttiVal)
                .fcpStatus(cwvStatus(fcpVal, FCP_GOOD, FCP_POOR))
                .lcpStatus(cwvStatus(lcpVal, LCP_GOOD, LCP_POOR))
                .clsStatus(cwvStatus(clsVal, CLS_GOOD, CLS_POOR))
                .ttiStatus(cwvStatus(ttiVal, TTI_GOOD, TTI_POOR))
                .build();

        return UiMetricsResponse.builder()
                .serviceName(serviceName)
                .fcpP50(fcpP50).fcpP75(fcpP75).fcpP95(fcpP95)
                .lcpP50(lcpP50).lcpP75(lcpP75).lcpP95(lcpP95)
                .clsP50(clsP50).clsP75(clsP75).clsP95(clsP95)
                .ttiP50(ttiP50).ttiP75(ttiP75).ttiP95(ttiP95)
                .current(current)
                .build();
    }

    // ── PromQL helpers ───────────────────────────────────────────────────────

    private TimeSeries queryPercentile(String serviceName, String metric, double quantile,
                                        String rateWindow, Instant start, Instant end,
                                        long stepSeconds, String seriesName) {
        String query = PromQLBuilder.metric(metric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        List<MetricDataPoint> points = extractFirstSeries(response);

        return TimeSeries.builder()
                .name(seriesName)
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(points)
                .build();
    }

    private Double queryInstant(String serviceName, String metric, double quantile, String rateWindow) {
        String query = PromQLBuilder.metric(metric)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();

        return extractInstantValue(prometheusClient.query(query));
    }

    private String cwvStatus(Double value, double goodThreshold, double poorThreshold) {
        if (value == null) return "unknown";
        if (value <= goodThreshold) return "good";
        if (value <= poorThreshold) return "needs-improvement";
        return "poor";
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
        PrometheusResponse.PromResult result = response.getData().getResult().getFirst();
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

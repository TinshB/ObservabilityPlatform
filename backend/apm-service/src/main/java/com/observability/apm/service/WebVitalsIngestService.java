package com.observability.apm.service;

import com.observability.apm.dto.WebVitalReport;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Ingests Core Web Vital reports from the browser and records them as
 * Micrometer histograms that Prometheus scrapes.
 *
 * Metric naming matches what UiMetricsService expects:
 *   browser_web_vital_fcp_seconds_bucket{job="..."}
 *   browser_web_vital_lcp_seconds_bucket{job="..."}
 *   browser_web_vital_cls_bucket{job="..."}
 *   browser_web_vital_tti_seconds_bucket{job="..."}
 */
@Slf4j
@Service
public class WebVitalsIngestService {

    private final MeterRegistry meterRegistry;
    private final Map<String, DistributionSummary> summaryCache = new ConcurrentHashMap<>();

    /** Timing metrics (value reported in ms, stored in seconds). */
    private static final Set<String> TIMING_METRICS = Set.of("FCP", "LCP", "INP", "TTFB");

    /** Map browser metric names to Prometheus metric names. */
    private static final Map<String, String> METRIC_NAME_MAP = Map.of(
            "FCP",  "browser.web.vital.fcp.seconds",
            "LCP",  "browser.web.vital.lcp.seconds",
            "CLS",  "browser.web.vital.cls",
            "INP",  "browser.web.vital.tti.seconds",  // INP maps to TTI
            "TTFB", "browser.web.vital.ttfb.seconds"
    );

    public WebVitalsIngestService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    /**
     * Record a single web vital measurement.
     */
    public void record(WebVitalReport report) {
        String upperName = report.getName().toUpperCase();
        String metricName = METRIC_NAME_MAP.get(upperName);

        if (metricName == null) {
            log.debug("Unknown web vital name: {}", report.getName());
            return;
        }

        // Convert ms → seconds for timing metrics (CLS is unitless)
        double value = TIMING_METRICS.contains(upperName)
                ? report.getValue() / 1000.0
                : report.getValue();

        DistributionSummary summary = getOrCreateSummary(metricName, report.getServiceName());
        summary.record(value);

        log.trace("Recorded web vital {}={} for service {}",
                report.getName(), value, report.getServiceName());
    }

    private DistributionSummary getOrCreateSummary(String metricName, String serviceName) {
        String cacheKey = metricName + ":" + serviceName;
        return summaryCache.computeIfAbsent(cacheKey, k ->
                DistributionSummary.builder(metricName)
                        .tag("job", serviceName)
                        .publishPercentileHistogram()
                        .register(meterRegistry));
    }
}

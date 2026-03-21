package com.observability.report.service;

import com.observability.report.dto.PerformanceReportData;
import com.observability.report.prometheus.PrometheusQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Story 14.3 — Performance Report Generator.
 * Aggregates latency trends, throughput, error budgets, and infra utilisation from Prometheus.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PerformanceReportGenerator {

    private final PrometheusQueryService prometheusQueryService;

    /**
     * Generate performance report data for the given time range and service.
     */
    public PerformanceReportData generate(String reportName,
                                          Instant timeRangeStart,
                                          Instant timeRangeEnd,
                                          String serviceName) {
        log.info("Generating Performance report '{}' for range [{} - {}], service: {}",
                reportName, timeRangeStart, timeRangeEnd, serviceName);

        String effectiveService = serviceName != null ? serviceName : ".*";

        // Query summaries
        PerformanceReportData.LatencySummary latencySummary =
                prometheusQueryService.queryLatencySummary(effectiveService, timeRangeStart, timeRangeEnd);

        PerformanceReportData.ThroughputSummary throughputSummary =
                prometheusQueryService.queryThroughputSummary(effectiveService, timeRangeStart, timeRangeEnd);

        PerformanceReportData.ErrorBudgetSummary errorBudget =
                prometheusQueryService.queryErrorBudget(effectiveService, timeRangeStart, timeRangeEnd);

        PerformanceReportData.InfraUtilisation infraUtilisation =
                prometheusQueryService.queryInfraUtilisation(effectiveService, timeRangeStart, timeRangeEnd);

        // Determine step size for trends based on time range duration
        String step = computeStep(timeRangeStart, timeRangeEnd);

        // Query trends
        List<PerformanceReportData.LatencyTrend> latencyTrends =
                prometheusQueryService.queryLatencyTrends(effectiveService, timeRangeStart, timeRangeEnd, step);

        List<PerformanceReportData.ThroughputTrend> throughputTrends =
                prometheusQueryService.queryThroughputTrends(effectiveService, timeRangeStart, timeRangeEnd, step);

        return PerformanceReportData.builder()
                .reportName(reportName)
                .generatedAt(Instant.now())
                .timeRangeStart(timeRangeStart)
                .timeRangeEnd(timeRangeEnd)
                .serviceName(serviceName)
                .latencySummary(latencySummary)
                .throughputSummary(throughputSummary)
                .errorBudgetSummary(errorBudget)
                .infraUtilisation(infraUtilisation)
                .latencyTrends(latencyTrends)
                .throughputTrends(throughputTrends)
                .topSlowEndpoints(List.of())
                .build();
    }

    /**
     * Compute an appropriate step size for range queries.
     * Daily reports → 1h steps, Weekly → 6h steps, Monthly → 1d steps.
     */
    private String computeStep(Instant start, Instant end) {
        long hours = Duration.between(start, end).toHours();
        if (hours <= 24) {
            return "1h";
        } else if (hours <= 168) { // 7 days
            return "6h";
        } else {
            return "1d";
        }
    }
}

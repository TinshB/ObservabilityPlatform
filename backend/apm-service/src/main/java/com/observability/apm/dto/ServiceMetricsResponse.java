package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 5.1 — Service-level metrics response.
 * Contains latency percentiles (P50/P95/P99), error rate, and RPS time-series.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceMetricsResponse {

    private String serviceName;

    /** Latency P50 in seconds over time. */
    private TimeSeries latencyP50;

    /** Latency P95 in seconds over time. */
    private TimeSeries latencyP95;

    /** Latency P99 in seconds over time. */
    private TimeSeries latencyP99;

    /** Error rate (5xx / total) as a ratio [0.0 – 1.0] over time. */
    private TimeSeries errorRate;

    /** Requests per second over time. */
    private TimeSeries requestRate;

    /** Total request count in the selected time range. */
    private Long totalRequestCount;

    /** Current instant values for dashboard cards. */
    private InstantMetrics current;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InstantMetrics {
        private Double latencyP50;
        private Double latencyP95;
        private Double latencyP99;
        private Double errorRate;
        private Double requestRate;
    }
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Story 11.4 — Per-dependency metrics response.
 * Contains latency histograms, error rate, and throughput for a specific dependency edge.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DependencyMetricsResponse {

    private UUID dependencyId;
    private String sourceServiceName;
    private String targetServiceName;
    private String dependencyType;   // HTTP, GRPC, DATABASE, CLOUD

    /** Time-series data for chart rendering. */
    private TimeSeries latencyP50;
    private TimeSeries latencyP95;
    private TimeSeries latencyP99;
    private TimeSeries errorRate;
    private TimeSeries throughput;

    /** Current instant values. */
    private InstantDependencyMetrics current;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InstantDependencyMetrics {
        private Double latencyP50;
        private Double latencyP95;
        private Double latencyP99;
        private Double errorRate;
        private Double throughput;     // requests per second
        private Long callCount1h;      // from dependency entity
        private Long errorCount1h;     // from dependency entity
        private Double avgLatencyMs1h; // from dependency entity
    }
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 9.1 — Unified correlation response.
 * Bundles a trace with its related metrics snapshot and correlated logs,
 * enabling single-request cross-signal navigation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CorrelationResponse {

    private TraceDetailResponse trace;
    private MetricsSnapshot metricsSnapshot;
    private LogSearchResponse relatedLogs;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricsSnapshot {
        private String serviceName;
        private Double latencyP50;
        private Double latencyP95;
        private Double latencyP99;
        private Double errorRate;
        private Double requestRate;
    }
}

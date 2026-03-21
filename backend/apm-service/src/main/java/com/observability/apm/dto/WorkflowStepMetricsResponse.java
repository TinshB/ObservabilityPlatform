package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Per-step live metrics for a workflow, combining Prometheus metrics and Jaeger trace data.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowStepMetricsResponse {

    private UUID workflowId;
    private String workflowName;
    private List<StepMetrics> steps;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StepMetrics {
        private UUID stepId;
        private int stepOrder;
        private String label;
        private String serviceName;
        private String httpMethod;
        private String pathPattern;

        /** Requests per second from Prometheus. */
        private Double requestRate;

        /** Error ratio (0.0–1.0) from Prometheus. */
        private Double errorRate;

        /** Latency percentiles in seconds from Prometheus. */
        private Double latencyP50;
        private Double latencyP95;
        private Double latencyP99;

        /** Recent trace count from Jaeger. */
        private Integer recentTraceCount;

        /** Recent error trace count from Jaeger. */
        private Integer recentErrorCount;
    }
}

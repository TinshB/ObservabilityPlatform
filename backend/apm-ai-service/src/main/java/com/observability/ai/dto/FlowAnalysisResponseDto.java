package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class FlowAnalysisResponseDto {

    private UUID analysisId;
    private String status;
    private OffsetDateTime completedAt;
    private int tracesAnalyzed;
    private String errorMessage;
    private List<FlowPatternDto> flowPatterns;
    private FlowGraphDto graph;

    @Data
    @Builder
    public static class FlowGraphDto {
        private List<FlowNodeDto> nodes;
        private List<FlowEdgeDto> edges;
    }

    @Data
    @Builder
    public static class FlowNodeDto {
        private String id;
        private String label;
        private String type;  // UI, BACKEND, DATABASE, CLOUD_COMPONENT, QUEUE, EXTERNAL
        private NodeMetricsDto metrics;
    }

    @Data
    @Builder
    public static class NodeMetricsDto {
        private int totalCalls;
        private double avgLatencyMs;
        private double errorRate;
    }

    @Data
    @Builder
    public static class FlowEdgeDto {
        private String source;
        private String target;
        private int callCount;
        private double avgLatencyMs;
        private double errorRate;
        private String httpMethod;
        private String httpPath;
    }
}

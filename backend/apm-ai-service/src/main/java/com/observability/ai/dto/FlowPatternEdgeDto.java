package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FlowPatternEdgeDto {
    private String source;
    private String target;
    private int callCount;
    private double avgLatencyMs;
    private double errorRate;
    private String httpMethod;
    private String httpPath;
}

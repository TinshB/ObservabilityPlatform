package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FlowPatternStepDto {
    private int order;
    private String serviceName;
    private String serviceType;
    private String method;
    private String path;
    private double avgLatencyMs;
    private double errorRate;
}

package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class FlowPatternDto {

    private UUID patternId;
    private String name;
    private int frequency;
    private double avgLatencyMs;
    private Double p50LatencyMs;
    private Double p95LatencyMs;
    private Double p99LatencyMs;
    private double errorRate;
    private List<FlowPatternStepDto> steps;
    private List<FlowPatternEdgeDto> edges;
    private List<String> sampleTraceIds;
}

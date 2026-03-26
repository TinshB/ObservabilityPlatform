package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class FlowAnalysisStartedDto {
    private UUID analysisId;
    private String status;
    private long estimatedDurationMs;
    private String pollUrl;
}

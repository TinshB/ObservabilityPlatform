package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Builder
public class ConvertToWorkflowResponseDto {
    private UUID workflowId;
    private String name;
    private int stepsCreated;
    private boolean monitoringEnabled;
    private ConvertToWorkflowRequestDto.SlaDto sla;
    private UUID sourceAnalysisId;
    private UUID sourcePatternId;
    private String dashboardUrl;
    private OffsetDateTime createdAt;
}

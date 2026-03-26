package com.observability.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class ConvertToWorkflowRequestDto {

    @NotBlank
    private String workflowName;

    private String description;
    private String ownerTeam;

    private SlaDto sla;

    @NotEmpty
    private List<WorkflowStepInput> steps;

    private boolean enableMonitoring = true;
    private List<UUID> alertChannelIds;

    @Data
    public static class SlaDto {
        private Integer maxDurationMs;
        private Double maxErrorRatePct;
    }

    @Data
    public static class WorkflowStepInput {
        private int stepOrder;
        @NotBlank
        private String serviceName;
        @NotBlank
        private String httpMethod;
        @NotBlank
        private String pathPattern;
        private String label;
    }
}

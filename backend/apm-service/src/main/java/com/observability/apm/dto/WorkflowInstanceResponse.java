package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Story 12.4 — Workflow instance response DTO.
 * Represents a single execution of a business workflow with optional per-step breakdown.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowInstanceResponse {

    private UUID id;
    private UUID workflowId;
    private String workflowName;
    private String traceId;
    private String status;
    private Instant startedAt;
    private Instant completedAt;
    private Long totalDurationMs;
    private boolean error;
    private int matchedSteps;
    private int totalSteps;
    private List<StepDetail> steps;
    private Instant createdAt;
    private Instant updatedAt;

    /**
     * Per-step breakdown — joined from workflow_instance_steps + workflow_steps metadata.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StepDetail {
        private UUID id;
        private UUID stepId;
        private int stepOrder;
        private String label;
        private String spanId;
        private String serviceName;
        private String operationName;
        private Long durationMs;
        private Integer httpStatus;
        private boolean error;
        private Instant startedAt;
    }
}

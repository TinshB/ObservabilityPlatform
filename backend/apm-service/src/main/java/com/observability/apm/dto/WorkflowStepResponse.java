package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 12.2 — Workflow step response DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowStepResponse {

    private UUID id;
    private UUID workflowId;
    private int stepOrder;
    private String serviceName;
    private String httpMethod;
    private String pathPattern;
    private String label;
    private Instant createdAt;
    private Instant updatedAt;
}

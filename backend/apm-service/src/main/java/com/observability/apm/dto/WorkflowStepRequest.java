package com.observability.apm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 12.2 — Request payload for creating or updating a workflow step.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowStepRequest {

    @NotNull
    private Integer stepOrder;

    @NotBlank
    private String serviceName;

    @NotBlank
    private String httpMethod;

    @NotBlank
    private String pathPattern;

    private String label;
}

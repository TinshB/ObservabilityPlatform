package com.observability.apm.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 12.1 — Request payload for creating a business workflow.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateWorkflowRequest {

    @NotBlank
    private String name;

    private String description;

    private String ownerTeam;

    private Integer maxDurationMs;

    private Double maxErrorRatePct;
}

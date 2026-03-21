package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 12.1 — Request payload for updating a business workflow.
 * Only non-null fields are applied.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateWorkflowRequest {

    private String name;

    private String description;

    private String ownerTeam;

    private Integer maxDurationMs;

    private Double maxErrorRatePct;

    private Boolean enabled;

    private Boolean active;
}

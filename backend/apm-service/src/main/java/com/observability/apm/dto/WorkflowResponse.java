package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 12.1 — Workflow response DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowResponse {

    private UUID id;
    private String name;
    private String description;
    private String ownerTeam;
    private Integer maxDurationMs;
    private Double maxErrorRatePct;
    private boolean enabled;
    private boolean active;
    private long stepCount;
    private Instant createdAt;
    private Instant updatedAt;
}

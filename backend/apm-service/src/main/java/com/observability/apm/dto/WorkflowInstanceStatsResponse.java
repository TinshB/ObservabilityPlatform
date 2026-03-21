package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Story 12.4 — Aggregate statistics for workflow instances.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowInstanceStatsResponse {

    private UUID workflowId;
    private String workflowName;
    private long totalInstances;
    private long completeCount;
    private long inProgressCount;
    private long failedCount;
    private double successRatePct;
    private double avgDurationMs;
    private long minDurationMs;
    private long maxDurationMs;
}

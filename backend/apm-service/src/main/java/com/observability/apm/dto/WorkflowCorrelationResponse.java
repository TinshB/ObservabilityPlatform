package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 12.3 — Response summary after running trace-to-workflow correlation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowCorrelationResponse {

    private int workflowsProcessed;
    private int tracesAnalyzed;
    private int instancesCreated;
    private int instancesUpdated;
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Story 12.3 — Request payload for triggering trace-to-workflow correlation.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowCorrelationRequest {

    private UUID workflowId;

    @Builder.Default
    private int lookbackMinutes = 60;

    @Builder.Default
    private int traceLimit = 50;
}

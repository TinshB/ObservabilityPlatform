package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Live correlation response — trace-to-workflow matching results from Jaeger,
 * returned directly without database persistence.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiveCorrelationResponse {

    private WorkflowInstanceStatsResponse stats;
    private List<WorkflowInstanceResponse> instances;
}

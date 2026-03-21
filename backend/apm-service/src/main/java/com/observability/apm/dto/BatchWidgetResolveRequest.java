package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Story 13.2 — Batch request to resolve multiple widgets at once.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchWidgetResolveRequest {

    private List<WidgetDataRequest> widgets;
    private Map<String, String> variables;
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 13.2 — Batch response wrapping resolved data for all requested widgets.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchWidgetResolveResponse {

    private List<WidgetDataResponse> results;
}

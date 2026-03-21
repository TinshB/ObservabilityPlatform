package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * Story 13.2 — Request to resolve data for a single widget.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WidgetDataRequest {

    private String widgetId;
    private DataSourceType dataSourceType;
    private String query;
    private Map<String, String> params;
    private Instant start;
    private Instant end;
    private long stepSeconds;
}

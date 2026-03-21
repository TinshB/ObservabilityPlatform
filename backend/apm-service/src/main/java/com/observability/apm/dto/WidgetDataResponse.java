package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 13.2 — Response containing resolved data for a single widget.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WidgetDataResponse {

    private String widgetId;
    private List<TimeSeries> timeSeries;
    private Object rawData;
    private String error;
}

package com.observability.apm.service;

import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;

/**
 * Story 13.2 — Strategy interface for resolving widget data from different data sources.
 */
public interface WidgetDataResolver {

    /**
     * Resolve data for a single widget request.
     *
     * @param request the widget data request (query already has variables substituted)
     * @return resolved widget data
     */
    WidgetDataResponse resolve(WidgetDataRequest request);
}

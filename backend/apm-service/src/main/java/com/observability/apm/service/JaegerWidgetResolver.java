package com.observability.apm.service;

import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Story 13.2 — Resolves widget data by querying Jaeger traces.
 * Uses {@link JaegerClient#getTraces} and returns raw trace data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JaegerWidgetResolver implements WidgetDataResolver {

    private final JaegerClient jaegerClient;

    @Override
    public WidgetDataResponse resolve(WidgetDataRequest request) {
        try {
            Map<String, String> params = request.getParams() != null ? request.getParams() : Map.of();
            String service = params.getOrDefault("service", request.getQuery());
            String operation = params.get("operation");
            String minDuration = params.get("minDuration");
            String maxDuration = params.get("maxDuration");
            String tags = params.get("tags");
            int limit = parseIntOrDefault(params.get("limit"), 20);

            JaegerResponse result = jaegerClient.getTraces(
                    service, operation,
                    request.getStart(), request.getEnd(),
                    minDuration, maxDuration, limit, tags);

            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(List.of())
                    .rawData(result)
                    .build();

        } catch (Exception ex) {
            log.error("Jaeger widget resolution failed for widget [{}]: {}",
                    request.getWidgetId(), ex.getMessage());
            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(List.of())
                    .error("Jaeger query failed: " + ex.getMessage())
                    .build();
        }
    }

    private static int parseIntOrDefault(String value, int defaultValue) {
        if (value == null) return defaultValue;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}

package com.observability.apm.service;

import com.observability.apm.dto.LogSearchResponse;
import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;
import com.observability.apm.elasticsearch.ElasticsearchLogClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Story 13.2 — Resolves widget data by querying Elasticsearch logs.
 * Uses {@link ElasticsearchLogClient#searchLogs} and returns raw log data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ElasticsearchWidgetResolver implements WidgetDataResolver {

    private final ElasticsearchLogClient elasticsearchLogClient;

    @Override
    public WidgetDataResponse resolve(WidgetDataRequest request) {
        try {
            Map<String, String> params = request.getParams() != null ? request.getParams() : Map.of();
            String serviceName = params.get("serviceName");
            String severity = params.get("severity");
            List<String> severities = severity != null ? List.of(severity.split(",")) : null;
            String searchText = request.getQuery();
            String traceId = params.get("traceId");
            int size = parseIntOrDefault(params.get("size"), 100);

            LogSearchResponse result = elasticsearchLogClient.searchLogs(
                    serviceName, severities, searchText, traceId,
                    request.getStart(), request.getEnd(),
                    0, size);

            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(List.of())
                    .rawData(result)
                    .build();

        } catch (Exception ex) {
            log.error("Elasticsearch widget resolution failed for widget [{}]: {}",
                    request.getWidgetId(), ex.getMessage());
            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(List.of())
                    .error("Elasticsearch query failed: " + ex.getMessage())
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

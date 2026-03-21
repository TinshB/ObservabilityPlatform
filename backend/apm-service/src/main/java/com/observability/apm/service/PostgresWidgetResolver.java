package com.observability.apm.service;

import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.AlertRepository;
import com.observability.apm.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Story 13.2 — Resolves widget data from PostgreSQL via JPA repositories.
 * Supports queries for services, alerts, and other application data.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PostgresWidgetResolver implements WidgetDataResolver {

    private final ServiceRepository serviceRepository;
    private final AlertRepository alertRepository;

    @Override
    public WidgetDataResponse resolve(WidgetDataRequest request) {
        try {
            Map<String, String> params = request.getParams() != null ? request.getParams() : Map.of();
            String entity = params.getOrDefault("entity", request.getQuery());
            Object result;

            result = switch (entity.toLowerCase()) {
                case "services" -> {
                    String search = params.get("search");
                    String env = params.get("environment");
                    int size = parseIntOrDefault(params.get("size"), 50);
                    yield serviceRepository.findWithFilters(
                            search, env, null, null, true, PageRequest.of(0, size));
                }
                case "service_names" ->
                    serviceRepository.findAll().stream()
                            .map(ServiceEntity::getName)
                            .toList();
                case "environments" ->
                    serviceRepository.findDistinctEnvironments();
                case "alerts" -> {
                    int size = parseIntOrDefault(params.get("size"), 50);
                    yield alertRepository.findAll(PageRequest.of(0, size));
                }
                default -> Map.of("error", "Unknown PostgreSQL entity: " + entity);
            };

            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(List.of())
                    .rawData(result)
                    .build();

        } catch (Exception ex) {
            log.error("PostgreSQL widget resolution failed for widget [{}]: {}",
                    request.getWidgetId(), ex.getMessage());
            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(List.of())
                    .error("PostgreSQL query failed: " + ex.getMessage())
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

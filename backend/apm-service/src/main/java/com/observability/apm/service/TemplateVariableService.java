package com.observability.apm.service;

import com.observability.apm.dto.TemplateVariableOptionsResponse;
import com.observability.apm.dto.VariableOption;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Story 13.3 — Resolves template variable options for dashboard dropdowns.
 * <p>
 * Supported variable types:
 * <ul>
 *   <li>{@code SERVICE} — all registered service names</li>
 *   <li>{@code ENVIRONMENT} — distinct environments from services</li>
 *   <li>{@code TIME_RANGE} — static time range presets</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateVariableService {

    private final ServiceRepository serviceRepository;

    private static final List<VariableOption> TIME_RANGE_PRESETS = List.of(
            VariableOption.builder().value("5m").label("Last 5 minutes").build(),
            VariableOption.builder().value("15m").label("Last 15 minutes").build(),
            VariableOption.builder().value("30m").label("Last 30 minutes").build(),
            VariableOption.builder().value("1h").label("Last 1 hour").build(),
            VariableOption.builder().value("3h").label("Last 3 hours").build(),
            VariableOption.builder().value("6h").label("Last 6 hours").build(),
            VariableOption.builder().value("12h").label("Last 12 hours").build(),
            VariableOption.builder().value("24h").label("Last 24 hours").build(),
            VariableOption.builder().value("7d").label("Last 7 days").build(),
            VariableOption.builder().value("30d").label("Last 30 days").build()
    );

    /**
     * Get available options for a given variable type.
     *
     * @param type the variable type (SERVICE, ENVIRONMENT, TIME_RANGE)
     * @return response containing the variable type and its available options
     */
    public TemplateVariableOptionsResponse getOptions(String type) {
        List<VariableOption> options = switch (type.toUpperCase()) {
            case "SERVICE" -> serviceRepository.findAll().stream()
                    .map(s -> VariableOption.builder()
                            .value(s.getName())
                            .label(s.getName())
                            .build())
                    .toList();
            case "ENVIRONMENT" -> serviceRepository.findDistinctEnvironments().stream()
                    .map(env -> VariableOption.builder()
                            .value(env)
                            .label(env)
                            .build())
                    .toList();
            case "TIME_RANGE" -> TIME_RANGE_PRESETS;
            default -> {
                log.warn("Unknown template variable type: {}", type);
                yield List.of();
            }
        };

        return TemplateVariableOptionsResponse.builder()
                .type(type.toUpperCase())
                .options(options)
                .build();
    }
}

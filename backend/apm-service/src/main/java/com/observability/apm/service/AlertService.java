package com.observability.apm.service;

import com.observability.apm.dto.AlertHistoryResponse;
import com.observability.apm.dto.AlertResponse;
import com.observability.apm.entity.AlertEntity;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.entity.SlaRuleEntity;
import com.observability.apm.repository.AlertRepository;
import com.observability.apm.repository.ServiceRepository;
import com.observability.apm.repository.SlaRuleRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Story 10.4 — Alert management service.
 * Provides query, acknowledge, and resolve operations for alerts.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertService {

    private final AlertRepository alertRepository;
    private final SlaRuleRepository slaRuleRepository;
    private final ServiceRepository serviceRepository;

    @Transactional(readOnly = true)
    public AlertResponse getAlert(UUID id) {
        AlertEntity entity = findById(id);
        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public Page<AlertResponse> listAlerts(UUID serviceId, String state, String severity, Pageable pageable) {
        return alertRepository.findWithFilters(serviceId, state, severity, pageable)
                .map(this::toResponse);
    }

    /**
     * Story 11.1 — Historical alerts with time-range filtering and summary stats.
     */
    @Transactional(readOnly = true)
    public AlertHistoryResponse listAlertHistory(
            UUID serviceId, String state, String severity,
            Instant start, Instant end, Pageable pageable) {

        Page<AlertResponse> alertPage = alertRepository
                .findAlertHistory(serviceId, state, severity, start, end, pageable)
                .map(this::toResponse);

        // Summary counts by state for the same filter window
        List<Object[]> rawCounts = alertRepository.countByStateInRange(serviceId, start, end);
        Map<String, Long> stateCounts = new HashMap<>();
        long total = 0;
        for (Object[] row : rawCounts) {
            String st = (String) row[0];
            Long count = (Long) row[1];
            stateCounts.put(st, count);
            total += count;
        }

        return AlertHistoryResponse.builder()
                .alerts(alertPage)
                .stateCounts(stateCounts)
                .totalAlerts(total)
                .build();
    }

    /**
     * Acknowledge an alert — marks it as seen by an operator.
     * Only FIRING alerts can be acknowledged.
     */
    @Transactional
    public AlertResponse acknowledgeAlert(UUID id, String acknowledgedBy) {
        AlertEntity entity = findById(id);

        if (!"FIRING".equals(entity.getState())) {
            throw new IllegalStateException(
                    "Only FIRING alerts can be acknowledged. Current state: " + entity.getState());
        }

        entity.setAcknowledgedAt(Instant.now());
        entity.setAcknowledgedBy(acknowledgedBy);
        entity = alertRepository.save(entity);

        log.info("Alert {} acknowledged by '{}'", id, acknowledgedBy);
        return toResponse(entity);
    }

    /**
     * Manually resolve an alert — transitions it to RESOLVED state.
     * Only FIRING or PENDING alerts can be manually resolved.
     */
    @Transactional
    public AlertResponse resolveAlert(UUID id) {
        AlertEntity entity = findById(id);

        if ("RESOLVED".equals(entity.getState()) || "OK".equals(entity.getState())) {
            throw new IllegalStateException(
                    "Alert is already in state: " + entity.getState());
        }

        entity.setState("RESOLVED");
        entity.setResolvedAt(Instant.now());
        entity = alertRepository.save(entity);

        log.info("Alert {} manually resolved", id);
        return toResponse(entity);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private AlertEntity findById(UUID id) {
        return alertRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Alert", id.toString()));
    }

    private AlertResponse toResponse(AlertEntity entity) {
        String slaRuleName = slaRuleRepository.findById(entity.getSlaRuleId())
                .map(SlaRuleEntity::getName)
                .orElse("unknown");
        String serviceName = serviceRepository.findById(entity.getServiceId())
                .map(ServiceEntity::getName)
                .orElse("unknown");

        return AlertResponse.builder()
                .id(entity.getId())
                .slaRuleId(entity.getSlaRuleId())
                .slaRuleName(slaRuleName)
                .serviceId(entity.getServiceId())
                .serviceName(serviceName)
                .state(entity.getState())
                .severity(entity.getSeverity())
                .message(entity.getMessage())
                .evaluatedValue(entity.getEvaluatedValue())
                .firedAt(entity.getFiredAt())
                .resolvedAt(entity.getResolvedAt())
                .acknowledgedAt(entity.getAcknowledgedAt())
                .acknowledgedBy(entity.getAcknowledgedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

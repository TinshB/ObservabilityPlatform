package com.observability.apm.service;

import com.observability.apm.dto.CreateSlaRuleRequest;
import com.observability.apm.dto.SlaRuleResponse;
import com.observability.apm.dto.UpdateSlaRuleRequest;
import com.observability.apm.entity.AlertChannelEntity;
import com.observability.apm.entity.SlaRuleEntity;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.AlertChannelRepository;
import com.observability.apm.repository.SlaRuleRepository;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * Story 10.1 — SLA Rule CRUD service.
 * Manages SLA rule lifecycle: create, read, update, delete.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SlaRuleService {

    private final SlaRuleRepository slaRuleRepository;
    private final ServiceRepository serviceRepository;
    private final AlertChannelRepository alertChannelRepository;

    private static final Set<String> VALID_SIGNAL_TYPES = Set.of("METRICS", "LOGS");
    private static final Set<String> VALID_OPERATORS = Set.of("GT", "GTE", "LT", "LTE", "EQ", "NEQ");
    private static final Set<String> VALID_SEVERITIES = Set.of("CRITICAL", "WARNING", "INFO");

    @Transactional
    public SlaRuleResponse createRule(CreateSlaRuleRequest request) {
        // Validate service exists
        ServiceEntity service = serviceRepository.findById(request.getServiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Service", request.getServiceId().toString()));

        validateSignalType(request.getSignalType());
        validateOperator(request.getOperator());

        SlaRuleEntity entity = SlaRuleEntity.builder()
                .serviceId(service.getId())
                .name(request.getName())
                .description(request.getDescription())
                .signalType(request.getSignalType())
                .metricName(request.getMetricName())
                .logCondition(request.getLogCondition())
                .operator(request.getOperator())
                .threshold(request.getThreshold())
                .evaluationWindow(request.getEvaluationWindow() != null ? request.getEvaluationWindow() : "5m")
                .pendingPeriods(request.getPendingPeriods() != null ? request.getPendingPeriods() : 1)
                .severity(request.getSeverity() != null && VALID_SEVERITIES.contains(request.getSeverity())
                        ? request.getSeverity() : "WARNING")
                .enabled(true)
                .groupKey(request.getGroupKey() != null ? request.getGroupKey() : "service")
                .suppressionWindow(request.getSuppressionWindow() != null ? request.getSuppressionWindow() : "15m")
                .build();

        // Attach channels if provided
        if (request.getChannelIds() != null && !request.getChannelIds().isEmpty()) {
            Set<AlertChannelEntity> channels = new HashSet<>(
                    alertChannelRepository.findAllById(request.getChannelIds()));
            entity.setChannels(channels);
        }

        entity = slaRuleRepository.save(entity);
        log.info("Created SLA rule '{}' for service '{}'", entity.getName(), service.getName());

        return toResponse(entity, service.getName());
    }

    @Transactional(readOnly = true)
    public SlaRuleResponse getRule(UUID id) {
        SlaRuleEntity entity = findById(id);
        String serviceName = resolveServiceName(entity.getServiceId());
        return toResponse(entity, serviceName);
    }

    @Transactional(readOnly = true)
    public Page<SlaRuleResponse> listRules(UUID serviceId, Boolean enabled, Pageable pageable) {
        return slaRuleRepository.findWithFilters(serviceId, enabled, pageable)
                .map(entity -> toResponse(entity, resolveServiceName(entity.getServiceId())));
    }

    @Transactional
    public SlaRuleResponse updateRule(UUID id, UpdateSlaRuleRequest request) {
        SlaRuleEntity entity = findById(id);

        if (request.getName() != null) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getSignalType() != null) {
            validateSignalType(request.getSignalType());
            entity.setSignalType(request.getSignalType());
        }
        if (request.getMetricName() != null) entity.setMetricName(request.getMetricName());
        if (request.getLogCondition() != null) entity.setLogCondition(request.getLogCondition());
        if (request.getOperator() != null) {
            validateOperator(request.getOperator());
            entity.setOperator(request.getOperator());
        }
        if (request.getThreshold() != null) entity.setThreshold(request.getThreshold());
        if (request.getEvaluationWindow() != null) entity.setEvaluationWindow(request.getEvaluationWindow());
        if (request.getPendingPeriods() != null) entity.setPendingPeriods(request.getPendingPeriods());
        if (request.getSeverity() != null) {
            if (VALID_SEVERITIES.contains(request.getSeverity())) {
                entity.setSeverity(request.getSeverity());
            }
        }
        if (request.getEnabled() != null) entity.setEnabled(request.getEnabled());
        if (request.getGroupKey() != null) entity.setGroupKey(request.getGroupKey());
        if (request.getSuppressionWindow() != null) entity.setSuppressionWindow(request.getSuppressionWindow());

        // Replace channels if provided
        if (request.getChannelIds() != null) {
            Set<AlertChannelEntity> channels = new HashSet<>(
                    alertChannelRepository.findAllById(request.getChannelIds()));
            entity.setChannels(channels);
        }

        entity = slaRuleRepository.save(entity);
        String serviceName = resolveServiceName(entity.getServiceId());
        log.info("Updated SLA rule '{}' (id={})", entity.getName(), entity.getId());

        return toResponse(entity, serviceName);
    }

    @Transactional
    public void deleteRule(UUID id) {
        SlaRuleEntity entity = findById(id);
        slaRuleRepository.delete(entity);
        log.info("Deleted SLA rule '{}' (id={})", entity.getName(), entity.getId());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private SlaRuleEntity findById(UUID id) {
        return slaRuleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SlaRule", id.toString()));
    }

    private String resolveServiceName(UUID serviceId) {
        return serviceRepository.findById(serviceId)
                .map(ServiceEntity::getName)
                .orElse("unknown");
    }

    private void validateSignalType(String signalType) {
        if (!VALID_SIGNAL_TYPES.contains(signalType)) {
            throw new IllegalArgumentException("Invalid signalType: " + signalType
                    + ". Must be one of: " + VALID_SIGNAL_TYPES);
        }
    }

    private void validateOperator(String operator) {
        if (!VALID_OPERATORS.contains(operator)) {
            throw new IllegalArgumentException("Invalid operator: " + operator
                    + ". Must be one of: " + VALID_OPERATORS);
        }
    }

    private SlaRuleResponse toResponse(SlaRuleEntity entity, String serviceName) {
        List<SlaRuleResponse.ChannelSummary> channelSummaries = entity.getChannels().stream()
                .map(ch -> SlaRuleResponse.ChannelSummary.builder()
                        .id(ch.getId())
                        .name(ch.getName())
                        .channelType(ch.getChannelType())
                        .build())
                .toList();

        return SlaRuleResponse.builder()
                .id(entity.getId())
                .serviceId(entity.getServiceId())
                .serviceName(serviceName)
                .name(entity.getName())
                .description(entity.getDescription())
                .signalType(entity.getSignalType())
                .metricName(entity.getMetricName())
                .logCondition(entity.getLogCondition())
                .operator(entity.getOperator())
                .threshold(entity.getThreshold())
                .evaluationWindow(entity.getEvaluationWindow())
                .pendingPeriods(entity.getPendingPeriods())
                .severity(entity.getSeverity())
                .enabled(entity.isEnabled())
                .groupKey(entity.getGroupKey())
                .suppressionWindow(entity.getSuppressionWindow())
                .channels(channelSummaries)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

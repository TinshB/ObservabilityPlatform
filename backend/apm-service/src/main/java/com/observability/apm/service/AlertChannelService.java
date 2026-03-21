package com.observability.apm.service;

import com.observability.apm.dto.AlertChannelResponse;
import com.observability.apm.dto.CreateAlertChannelRequest;
import com.observability.apm.dto.UpdateAlertChannelRequest;
import com.observability.apm.entity.AlertChannelEntity;
import com.observability.apm.repository.AlertChannelRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Story 10.6 — Alert channel CRUD service.
 * Manages notification channel lifecycle (EMAIL, SMS, MS_TEAMS).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AlertChannelService {

    private final AlertChannelRepository alertChannelRepository;

    private static final Set<String> VALID_CHANNEL_TYPES = Set.of("EMAIL", "SMS", "MS_TEAMS");

    @Transactional
    public AlertChannelResponse createChannel(CreateAlertChannelRequest request) {
        validateChannelType(request.getChannelType());

        AlertChannelEntity entity = AlertChannelEntity.builder()
                .name(request.getName())
                .channelType(request.getChannelType())
                .config(request.getConfig())
                .enabled(true)
                .build();

        entity = alertChannelRepository.save(entity);
        log.info("Created alert channel '{}' (type={})", entity.getName(), entity.getChannelType());

        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public AlertChannelResponse getChannel(UUID id) {
        AlertChannelEntity entity = findById(id);
        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public List<AlertChannelResponse> listChannels() {
        return alertChannelRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AlertChannelResponse updateChannel(UUID id, UpdateAlertChannelRequest request) {
        AlertChannelEntity entity = findById(id);

        if (request.getName() != null) entity.setName(request.getName());
        if (request.getChannelType() != null) {
            validateChannelType(request.getChannelType());
            entity.setChannelType(request.getChannelType());
        }
        if (request.getConfig() != null) entity.setConfig(request.getConfig());
        if (request.getEnabled() != null) entity.setEnabled(request.getEnabled());

        entity = alertChannelRepository.save(entity);
        log.info("Updated alert channel '{}' (id={})", entity.getName(), entity.getId());

        return toResponse(entity);
    }

    @Transactional
    public void deleteChannel(UUID id) {
        AlertChannelEntity entity = findById(id);
        alertChannelRepository.delete(entity);
        log.info("Deleted alert channel '{}' (id={})", entity.getName(), entity.getId());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private AlertChannelEntity findById(UUID id) {
        return alertChannelRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("AlertChannel", id.toString()));
    }

    private void validateChannelType(String channelType) {
        if (!VALID_CHANNEL_TYPES.contains(channelType)) {
            throw new IllegalArgumentException("Invalid channelType: " + channelType
                    + ". Must be one of: " + VALID_CHANNEL_TYPES);
        }
    }

    private AlertChannelResponse toResponse(AlertChannelEntity entity) {
        return AlertChannelResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .channelType(entity.getChannelType())
                .config(entity.getConfig())
                .enabled(entity.isEnabled())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

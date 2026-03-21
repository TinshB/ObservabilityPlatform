package com.observability.apm.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.apm.dto.*;
import com.observability.apm.entity.DashboardEntity;
import com.observability.apm.repository.DashboardRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Story 13.1 — CRUD service for dashboards with JSONB widget layout.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private final DashboardRepository dashboardRepository;
    private final ObjectMapper objectMapper;

    private static final String DEFAULT_LAYOUT = "{\"widgets\":[],\"variables\":[]}";

    // ── CRUD ──────────────────────────────────────────────────────────────────────

    @Transactional
    public DashboardResponse createDashboard(CreateDashboardRequest request) {
        String layout = request.getLayout() != null ? request.getLayout() : DEFAULT_LAYOUT;
        validateLayout(layout);

        DashboardEntity entity = DashboardEntity.builder()
                .name(request.getName())
                .description(request.getDescription())
                .ownerId(request.getOwnerId())
                .template(Boolean.TRUE.equals(request.getIsTemplate()))
                .tags(request.getTags())
                .layout(layout)
                .build();

        entity = dashboardRepository.save(entity);
        log.info("Created dashboard '{}' (id={}, owner={})", entity.getName(), entity.getId(), entity.getOwnerId());

        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(UUID id) {
        DashboardEntity entity = findById(id);
        return toResponse(entity);
    }

    @Transactional(readOnly = true)
    public Page<DashboardResponse> listDashboards(UUID ownerId, Boolean isTemplate, String search, Pageable pageable) {
        return dashboardRepository.findWithFilters(ownerId, isTemplate, search, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public List<DashboardResponse> listTemplates() {
        return dashboardRepository.findByTemplateTrueOrderByNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public DashboardResponse updateDashboard(UUID id, UpdateDashboardRequest request) {
        DashboardEntity entity = findById(id);

        if (request.getName() != null) entity.setName(request.getName());
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getIsTemplate() != null) entity.setTemplate(request.getIsTemplate());
        if (request.getTags() != null) entity.setTags(request.getTags());
        if (request.getLayout() != null) {
            validateLayout(request.getLayout());
            entity.setLayout(request.getLayout());
        }

        entity = dashboardRepository.save(entity);
        log.info("Updated dashboard '{}' (id={})", entity.getName(), entity.getId());

        return toResponse(entity);
    }

    @Transactional
    public void deleteDashboard(UUID id) {
        DashboardEntity entity = findById(id);
        dashboardRepository.delete(entity);
        log.info("Deleted dashboard '{}' (id={})", entity.getName(), entity.getId());
    }

    @Transactional
    public DashboardResponse cloneDashboard(UUID id, UUID newOwnerId, String name) {
        DashboardEntity source = findById(id);

        String cloneName = (name != null && !name.isBlank()) ? name.trim() : source.getName() + " (Copy)";

        DashboardEntity clone = DashboardEntity.builder()
                .name(cloneName)
                .description(source.getDescription())
                .ownerId(newOwnerId)
                .template(false)
                .tags(source.getTags())
                .layout(source.getLayout())
                .build();

        clone = dashboardRepository.save(clone);
        log.info("Cloned dashboard '{}' → '{}' (id={}, owner={})",
                source.getName(), clone.getName(), clone.getId(), clone.getOwnerId());

        return toResponse(clone);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────────

    private DashboardEntity findById(UUID id) {
        return dashboardRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Dashboard", id.toString()));
    }

    private void validateLayout(String layout) {
        try {
            JsonNode node = objectMapper.readTree(layout);
            if (!node.isObject()) {
                throw new IllegalArgumentException("Layout must be a JSON object");
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid JSON layout: " + e.getMessage());
        }
    }

    private DashboardResponse toResponse(DashboardEntity entity) {
        return DashboardResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .ownerId(entity.getOwnerId())
                .isTemplate(entity.isTemplate())
                .tags(entity.getTags())
                .layout(entity.getLayout())
                .widgetCount(countWidgets(entity.getLayout()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private int countWidgets(String layout) {
        try {
            JsonNode node = objectMapper.readTree(layout);
            JsonNode widgets = node.get("widgets");
            return (widgets != null && widgets.isArray()) ? widgets.size() : 0;
        } catch (Exception e) {
            return 0;
        }
    }
}

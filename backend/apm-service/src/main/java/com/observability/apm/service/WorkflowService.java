package com.observability.apm.service;

import com.observability.apm.dto.*;
import com.observability.apm.entity.WorkflowEntity;
import com.observability.apm.entity.WorkflowStepEntity;
import com.observability.apm.repository.WorkflowRepository;
import com.observability.apm.repository.WorkflowStepRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Story 12.1, 12.2 — CRUD service for workflows and workflow steps.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final WorkflowRepository workflowRepository;
    private final WorkflowStepRepository workflowStepRepository;

    private static final Set<String> VALID_HTTP_METHODS = Set.of(
            "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS");

    // ── Workflow CRUD ────────────────────────────────────────────────────────────

    @Transactional
    public WorkflowResponse createWorkflow(CreateWorkflowRequest request) {
        workflowRepository.findByName(request.getName()).ifPresent(existing -> {
            throw new IllegalArgumentException("Workflow with name '" + request.getName() + "' already exists");
        });

        WorkflowEntity entity = WorkflowEntity.builder()
                .name(request.getName())
                .description(request.getDescription())
                .ownerTeam(request.getOwnerTeam())
                .maxDurationMs(request.getMaxDurationMs())
                .maxErrorRatePct(request.getMaxErrorRatePct())
                .build();

        entity = workflowRepository.save(entity);
        log.info("Created workflow '{}' (id={})", entity.getName(), entity.getId());

        return toWorkflowResponse(entity, 0);
    }

    @Transactional(readOnly = true)
    public WorkflowResponse getWorkflow(UUID id) {
        WorkflowEntity entity = findWorkflowById(id);
        long stepCount = workflowStepRepository.countByWorkflowId(id);
        return toWorkflowResponse(entity, stepCount);
    }

    @Transactional(readOnly = true)
    public Page<WorkflowResponse> listWorkflows(Boolean enabled, Boolean active, Pageable pageable) {
        return workflowRepository.findWithFilters(enabled, active, pageable)
                .map(entity -> toWorkflowResponse(entity,
                        workflowStepRepository.countByWorkflowId(entity.getId())));
    }

    @Transactional
    public WorkflowResponse updateWorkflow(UUID id, UpdateWorkflowRequest request) {
        WorkflowEntity entity = findWorkflowById(id);

        if (request.getName() != null) {
            workflowRepository.findByName(request.getName())
                    .filter(existing -> !existing.getId().equals(id))
                    .ifPresent(existing -> {
                        throw new IllegalArgumentException(
                                "Workflow with name '" + request.getName() + "' already exists");
                    });
            entity.setName(request.getName());
        }
        if (request.getDescription() != null) entity.setDescription(request.getDescription());
        if (request.getOwnerTeam() != null) entity.setOwnerTeam(request.getOwnerTeam());
        if (request.getMaxDurationMs() != null) entity.setMaxDurationMs(request.getMaxDurationMs());
        if (request.getMaxErrorRatePct() != null) entity.setMaxErrorRatePct(request.getMaxErrorRatePct());
        if (request.getEnabled() != null) entity.setEnabled(request.getEnabled());
        if (request.getActive() != null) entity.setActive(request.getActive());

        entity = workflowRepository.save(entity);
        long stepCount = workflowStepRepository.countByWorkflowId(id);
        log.info("Updated workflow '{}' (id={})", entity.getName(), entity.getId());

        return toWorkflowResponse(entity, stepCount);
    }

    @Transactional
    public void deleteWorkflow(UUID id) {
        WorkflowEntity entity = findWorkflowById(id);
        workflowRepository.delete(entity);
        log.info("Deleted workflow '{}' (id={})", entity.getName(), entity.getId());
    }

    // ── Step CRUD ────────────────────────────────────────────────────────────────

    @Transactional
    public WorkflowStepResponse createStep(UUID workflowId, WorkflowStepRequest request) {
        findWorkflowById(workflowId);
        validateHttpMethod(request.getHttpMethod());

        int stepOrder;
        if (request.getStepOrder() == null) {
            // Auto-assign next available step order
            stepOrder = workflowStepRepository.findMaxStepOrder(workflowId) + 1;
        } else {
            stepOrder = request.getStepOrder();
            // Multiple APIs can share the same stepOrder (they form a single stage)
        }

        WorkflowStepEntity entity = WorkflowStepEntity.builder()
                .workflowId(workflowId)
                .stepOrder(stepOrder)
                .serviceName(request.getServiceName())
                .httpMethod(request.getHttpMethod().toUpperCase())
                .pathPattern(request.getPathPattern())
                .label(request.getLabel())
                .build();

        entity = workflowStepRepository.save(entity);
        log.info("Created step {} for workflow {} (stepId={})",
                entity.getStepOrder(), workflowId, entity.getId());

        return toStepResponse(entity);
    }

    @Transactional(readOnly = true)
    public List<WorkflowStepResponse> listSteps(UUID workflowId) {
        findWorkflowById(workflowId);
        return workflowStepRepository.findByWorkflowIdOrderByStepOrderAsc(workflowId).stream()
                .map(this::toStepResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkflowStepResponse getStep(UUID workflowId, UUID stepId) {
        findWorkflowById(workflowId);
        WorkflowStepEntity entity = findStepById(stepId);
        if (!entity.getWorkflowId().equals(workflowId)) {
            throw new ResourceNotFoundException("WorkflowStep", stepId.toString());
        }
        return toStepResponse(entity);
    }

    @Transactional
    public WorkflowStepResponse updateStep(UUID workflowId, UUID stepId, WorkflowStepRequest request) {
        findWorkflowById(workflowId);
        WorkflowStepEntity entity = findStepById(stepId);
        if (!entity.getWorkflowId().equals(workflowId)) {
            throw new ResourceNotFoundException("WorkflowStep", stepId.toString());
        }

        validateHttpMethod(request.getHttpMethod());

        // stepOrder change is allowed — multiple APIs can share the same stepOrder

        entity.setStepOrder(request.getStepOrder());
        entity.setServiceName(request.getServiceName());
        entity.setHttpMethod(request.getHttpMethod().toUpperCase());
        entity.setPathPattern(request.getPathPattern());
        entity.setLabel(request.getLabel());

        entity = workflowStepRepository.save(entity);
        log.info("Updated step {} for workflow {} (stepId={})",
                entity.getStepOrder(), workflowId, entity.getId());

        return toStepResponse(entity);
    }

    @Transactional
    public void deleteStep(UUID workflowId, UUID stepId) {
        findWorkflowById(workflowId);
        WorkflowStepEntity entity = findStepById(stepId);
        if (!entity.getWorkflowId().equals(workflowId)) {
            throw new ResourceNotFoundException("WorkflowStep", stepId.toString());
        }
        workflowStepRepository.delete(entity);
        log.info("Deleted step {} from workflow {} (stepId={})",
                entity.getStepOrder(), workflowId, entity.getId());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private WorkflowEntity findWorkflowById(UUID id) {
        return workflowRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Workflow", id.toString()));
    }

    private WorkflowStepEntity findStepById(UUID id) {
        return workflowStepRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowStep", id.toString()));
    }

    private void validateHttpMethod(String method) {
        if (method == null || !VALID_HTTP_METHODS.contains(method.toUpperCase())) {
            throw new IllegalArgumentException("Invalid HTTP method: " + method
                    + ". Must be one of: " + VALID_HTTP_METHODS);
        }
    }

    private WorkflowResponse toWorkflowResponse(WorkflowEntity entity, long stepCount) {
        return WorkflowResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .ownerTeam(entity.getOwnerTeam())
                .maxDurationMs(entity.getMaxDurationMs())
                .maxErrorRatePct(entity.getMaxErrorRatePct())
                .enabled(entity.isEnabled())
                .active(entity.isActive())
                .stepCount(stepCount)
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private WorkflowStepResponse toStepResponse(WorkflowStepEntity entity) {
        return WorkflowStepResponse.builder()
                .id(entity.getId())
                .workflowId(entity.getWorkflowId())
                .stepOrder(entity.getStepOrder())
                .serviceName(entity.getServiceName())
                .httpMethod(entity.getHttpMethod())
                .pathPattern(entity.getPathPattern())
                .label(entity.getLabel())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

package com.observability.apm.service;

import com.observability.apm.dto.WorkflowInstanceResponse;
import com.observability.apm.dto.WorkflowInstanceStatsResponse;
import com.observability.apm.entity.WorkflowEntity;
import com.observability.apm.entity.WorkflowInstanceEntity;
import com.observability.apm.entity.WorkflowInstanceStepEntity;
import com.observability.apm.entity.WorkflowStepEntity;
import com.observability.apm.repository.WorkflowInstanceRepository;
import com.observability.apm.repository.WorkflowInstanceStepRepository;
import com.observability.apm.repository.WorkflowRepository;
import com.observability.apm.repository.WorkflowStepRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Story 12.4 — Workflow instance query service.
 * Provides list, detail, and stats views of workflow executions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowInstanceService {

    private final WorkflowRepository workflowRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final WorkflowInstanceRepository workflowInstanceRepository;
    private final WorkflowInstanceStepRepository workflowInstanceStepRepository;

    /**
     * List workflow instances with optional filters (status, date range).
     */
    @Transactional(readOnly = true)
    public Page<WorkflowInstanceResponse> listInstances(UUID workflowId, String status,
                                                         Instant from, Instant to,
                                                         Pageable pageable) {
        WorkflowEntity workflow = findWorkflowById(workflowId);
        long totalSteps = workflowStepRepository.countByWorkflowId(workflowId);

        return workflowInstanceRepository.findWithFilters(workflowId, status, from, to, pageable)
                .map(instance -> toListResponse(instance, workflow.getName(), totalSteps));
    }

    /**
     * Get a single workflow instance with full per-step breakdown.
     */
    @Transactional(readOnly = true)
    public WorkflowInstanceResponse getInstance(UUID workflowId, UUID instanceId) {
        WorkflowEntity workflow = findWorkflowById(workflowId);
        WorkflowInstanceEntity instance = workflowInstanceRepository.findById(instanceId)
                .orElseThrow(() -> new ResourceNotFoundException("WorkflowInstance", instanceId.toString()));

        if (!instance.getWorkflowId().equals(workflowId)) {
            throw new ResourceNotFoundException("WorkflowInstance", instanceId.toString());
        }

        // Load workflow steps for metadata (stepOrder, label)
        Map<UUID, WorkflowStepEntity> stepMap = workflowStepRepository
                .findByWorkflowIdOrderByStepOrderAsc(workflowId).stream()
                .collect(Collectors.toMap(WorkflowStepEntity::getId, Function.identity()));

        long totalSteps = stepMap.size();

        // Load instance steps ordered by startedAt
        List<WorkflowInstanceStepEntity> instanceSteps =
                workflowInstanceStepRepository.findByInstanceIdOrderByStartedAtAsc(instanceId);

        List<WorkflowInstanceResponse.StepDetail> stepDetails = instanceSteps.stream()
                .map(is -> {
                    WorkflowStepEntity stepDef = stepMap.get(is.getStepId());
                    return WorkflowInstanceResponse.StepDetail.builder()
                            .id(is.getId())
                            .stepId(is.getStepId())
                            .stepOrder(stepDef != null ? stepDef.getStepOrder() : 0)
                            .label(stepDef != null ? stepDef.getLabel() : null)
                            .spanId(is.getSpanId())
                            .serviceName(is.getServiceName())
                            .operationName(is.getOperationName())
                            .durationMs(is.getDurationMs())
                            .httpStatus(is.getHttpStatus())
                            .error(is.isError())
                            .startedAt(is.getStartedAt())
                            .build();
                })
                .toList();

        return WorkflowInstanceResponse.builder()
                .id(instance.getId())
                .workflowId(instance.getWorkflowId())
                .workflowName(workflow.getName())
                .traceId(instance.getTraceId())
                .status(instance.getStatus())
                .startedAt(instance.getStartedAt())
                .completedAt(instance.getCompletedAt())
                .totalDurationMs(instance.getTotalDurationMs())
                .error(instance.isError())
                .matchedSteps(instanceSteps.size())
                .totalSteps((int) totalSteps)
                .steps(stepDetails)
                .createdAt(instance.getCreatedAt())
                .updatedAt(instance.getUpdatedAt())
                .build();
    }

    /**
     * Aggregate stats for a workflow: counts by status, success rate, duration stats.
     */
    @Transactional(readOnly = true)
    public WorkflowInstanceStatsResponse getStats(UUID workflowId) {
        WorkflowEntity workflow = findWorkflowById(workflowId);

        long total = workflowInstanceRepository.countByWorkflowId(workflowId);
        long complete = workflowInstanceRepository.countByWorkflowIdAndStatus(workflowId, "COMPLETE");
        long inProgress = workflowInstanceRepository.countByWorkflowIdAndStatus(workflowId, "IN_PROGRESS");
        long failed = workflowInstanceRepository.countByWorkflowIdAndStatus(workflowId, "FAILED");

        double successRate = total > 0 ? (complete * 100.0) / total : 0.0;

        double avgDuration = 0;
        long minDuration = 0;
        long maxDuration = 0;
        if (total > 0) {
            avgDuration = workflowInstanceRepository.avgDurationMsByWorkflowId(workflowId);
            minDuration = workflowInstanceRepository.minDurationMsByWorkflowId(workflowId);
            maxDuration = workflowInstanceRepository.maxDurationMsByWorkflowId(workflowId);
        }

        return WorkflowInstanceStatsResponse.builder()
                .workflowId(workflowId)
                .workflowName(workflow.getName())
                .totalInstances(total)
                .completeCount(complete)
                .inProgressCount(inProgress)
                .failedCount(failed)
                .successRatePct(Math.round(successRate * 100.0) / 100.0)
                .avgDurationMs(Math.round(avgDuration * 100.0) / 100.0)
                .minDurationMs(minDuration)
                .maxDurationMs(maxDuration)
                .build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private WorkflowEntity findWorkflowById(UUID id) {
        return workflowRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Workflow", id.toString()));
    }

    /**
     * List-level response — no step details, just counts.
     */
    private WorkflowInstanceResponse toListResponse(WorkflowInstanceEntity instance,
                                                     String workflowName,
                                                     long totalSteps) {
        List<WorkflowInstanceStepEntity> instanceSteps =
                workflowInstanceStepRepository.findByInstanceId(instance.getId());

        return WorkflowInstanceResponse.builder()
                .id(instance.getId())
                .workflowId(instance.getWorkflowId())
                .workflowName(workflowName)
                .traceId(instance.getTraceId())
                .status(instance.getStatus())
                .startedAt(instance.getStartedAt())
                .completedAt(instance.getCompletedAt())
                .totalDurationMs(instance.getTotalDurationMs())
                .error(instance.isError())
                .matchedSteps(instanceSteps.size())
                .totalSteps((int) totalSteps)
                .createdAt(instance.getCreatedAt())
                .updatedAt(instance.getUpdatedAt())
                .build();
    }
}

package com.observability.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.observability.ai.client.ApmServiceClient;
import com.observability.ai.dto.*;
import com.observability.ai.entity.FlowPatternEntity;
import com.observability.ai.repository.FlowAnalysisRepository;
import com.observability.ai.repository.FlowPatternRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * Converts discovered flow patterns into monitored Workflow definitions
 * via the apm-service Workflow API. Also handles SLA suggestions and drift detection.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowConversionService {

    private final ApmServiceClient apmClient;
    private final FlowAnalysisRepository analysisRepo;
    private final FlowPatternRepository patternRepo;

    /**
     * Convert a discovered flow pattern into a workflow definition.
     */
    @Transactional
    public ConvertToWorkflowResponseDto convertToWorkflow(UUID analysisId, UUID patternId,
                                                           ConvertToWorkflowRequestDto request) {
        // Validate analysis and pattern exist
        var analysis = analysisRepo.findById(analysisId)
                .orElseThrow(() -> new RuntimeException("Analysis not found: " + analysisId));
        var pattern = patternRepo.findById(patternId)
                .orElseThrow(() -> new RuntimeException("Pattern not found: " + patternId));

        // 1. Create workflow via apm-service
        Map<String, Object> workflowPayload = new LinkedHashMap<>();
        workflowPayload.put("name", request.getWorkflowName());
        workflowPayload.put("description", request.getDescription() != null
                ? request.getDescription()
                : "AI-generated from flow analysis on " + OffsetDateTime.now().toLocalDate());
        workflowPayload.put("ownerTeam", request.getOwnerTeam());
        workflowPayload.put("enabled", request.isEnableMonitoring());

        if (request.getSla() != null) {
            if (request.getSla().getMaxDurationMs() != null) {
                workflowPayload.put("maxDurationMs", request.getSla().getMaxDurationMs());
            }
            if (request.getSla().getMaxErrorRatePct() != null) {
                workflowPayload.put("maxErrorRatePct", request.getSla().getMaxErrorRatePct());
            }
        }

        JsonNode createdWorkflow = apmClient.createWorkflow(workflowPayload);
        UUID workflowId = UUID.fromString(createdWorkflow.get("id").asText());

        log.info("Created workflow {} from pattern {} (analysis {})",
                workflowId, patternId, analysisId);

        // 2. Add steps to the workflow
        int stepsCreated = 0;
        for (var step : request.getSteps()) {
            Map<String, Object> stepPayload = new LinkedHashMap<>();
            stepPayload.put("stepOrder", step.getStepOrder());
            stepPayload.put("serviceName", step.getServiceName());
            stepPayload.put("httpMethod", step.getHttpMethod());
            stepPayload.put("pathPattern", step.getPathPattern());
            stepPayload.put("label", step.getLabel() != null
                    ? step.getLabel()
                    : step.getHttpMethod() + " " + step.getPathPattern());

            try {
                apmClient.addWorkflowStep(workflowId, stepPayload);
                stepsCreated++;
            } catch (Exception e) {
                log.warn("Failed to add step {} to workflow {}: {}",
                        step.getStepOrder(), workflowId, e.getMessage());
            }
        }

        return ConvertToWorkflowResponseDto.builder()
                .workflowId(workflowId)
                .name(request.getWorkflowName())
                .stepsCreated(stepsCreated)
                .monitoringEnabled(request.isEnableMonitoring())
                .sla(request.getSla())
                .sourceAnalysisId(analysisId)
                .sourcePatternId(patternId)
                .dashboardUrl("/workflows/" + workflowId + "/dashboard")
                .createdAt(OffsetDateTime.now())
                .build();
    }

    /**
     * Generate SLA threshold suggestions based on observed pattern metrics.
     */
    @Transactional(readOnly = true)
    public SlaSuggestionDto suggestSla(UUID analysisId, UUID patternId) {
        var analysis = analysisRepo.findById(analysisId)
                .orElseThrow(() -> new RuntimeException("Analysis not found: " + analysisId));
        var pattern = patternRepo.findById(patternId)
                .orElseThrow(() -> new RuntimeException("Pattern not found: " + patternId));

        // Suggest max duration as P95 rounded up to nearest 100ms
        double p95 = pattern.getP95LatencyMs() != null ? pattern.getP95LatencyMs() : 0;
        int suggestedMaxDuration = (int) (Math.ceil(p95 / 100.0) * 100);
        if (suggestedMaxDuration < 100) suggestedMaxDuration = 1000; // minimum 1s

        // Suggest error rate as observed + 1%, capped at 10%
        double suggestedErrorRate = Math.min(10.0, pattern.getErrorRate() * 100 + 1.0);

        return SlaSuggestionDto.builder()
                .suggestedMaxDurationMs(suggestedMaxDuration)
                .suggestedMaxErrorRatePct(Math.round(suggestedErrorRate * 10.0) / 10.0)
                .basedOn(SlaSuggestionDto.AnalysisBasis.builder()
                        .tracesAnalyzed(pattern.getFrequency())
                        .timeRangeStart(analysis.getTimeRangeStart())
                        .timeRangeEnd(analysis.getTimeRangeEnd())
                        .observedErrorRate(pattern.getErrorRate())
                        .latencyStats(SlaSuggestionDto.LatencyStats.builder()
                                .avgMs(pattern.getAvgLatencyMs() != null ? pattern.getAvgLatencyMs() : 0)
                                .p50Ms(pattern.getP50LatencyMs() != null ? pattern.getP50LatencyMs() : 0)
                                .p95Ms(p95)
                                .p99Ms(pattern.getP99LatencyMs() != null ? pattern.getP99LatencyMs() : 0)
                                .build())
                        .build())
                .build();
    }

    /**
     * Compare discovered patterns against existing workflows to detect drift.
     */
    @Transactional(readOnly = true)
    public DriftCheckResponseDto checkDrift(UUID analysisId, List<UUID> workflowIds) {
        var patterns = patternRepo.findByAnalysisIdOrderByFrequencyDesc(analysisId);
        List<DriftCheckResponseDto.DriftResult> drifts = new ArrayList<>();

        for (UUID workflowId : workflowIds) {
            try {
                JsonNode workflow = apmClient.getWorkflow(workflowId);
                JsonNode existingSteps = apmClient.getWorkflowSteps(workflowId);

                if (existingSteps == null || !existingSteps.isArray()) continue;

                // Build existing step signatures
                List<String> existingSignatures = new ArrayList<>();
                for (JsonNode step : existingSteps) {
                    existingSignatures.add(
                            step.path("serviceName").asText() + ":"
                            + step.path("httpMethod").asText() + ":"
                            + step.path("pathPattern").asText());
                }

                // Find best matching pattern
                FlowPatternEntity bestMatch = null;
                int bestOverlap = 0;

                for (var pattern : patterns) {
                    List<String> patternSignatures = pattern.getSteps().stream()
                            .map(s -> s.getServiceName() + ":" + s.getHttpMethod() + ":" + s.getPathPattern())
                            .toList();

                    int overlap = (int) patternSignatures.stream()
                            .filter(existingSignatures::contains).count();
                    if (overlap > bestOverlap) {
                        bestOverlap = overlap;
                        bestMatch = pattern;
                    }
                }

                if (bestMatch != null && bestOverlap > 0) {
                    var changes = computeDriftChanges(existingSteps, bestMatch);
                    boolean hasDrift = !changes.getAddedSteps().isEmpty()
                            || !changes.getRemovedSteps().isEmpty()
                            || !changes.getModifiedSteps().isEmpty();

                    if (hasDrift) {
                        String severity = changes.getAddedSteps().size() + changes.getRemovedSteps().size() > 2
                                ? "CRITICAL" : changes.getModifiedSteps().isEmpty() ? "INFO" : "WARNING";

                        drifts.add(DriftCheckResponseDto.DriftResult.builder()
                                .workflowId(workflowId)
                                .workflowName(workflow.path("name").asText())
                                .matchedPatternId(bestMatch.getId())
                                .changes(changes)
                                .severity(severity)
                                .build());
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to check drift for workflow {}: {}", workflowId, e.getMessage());
            }
        }

        return DriftCheckResponseDto.builder().drifts(drifts).build();
    }

    private DriftCheckResponseDto.DriftChanges computeDriftChanges(
            JsonNode existingSteps, FlowPatternEntity pattern) {

        // Build maps of step signatures
        Map<String, JsonNode> existingMap = new LinkedHashMap<>();
        for (JsonNode step : existingSteps) {
            String sig = step.path("serviceName").asText() + ":"
                    + step.path("httpMethod").asText() + ":"
                    + step.path("pathPattern").asText();
            existingMap.put(sig, step);
        }

        Set<String> patternSigs = new LinkedHashSet<>();
        for (var step : pattern.getSteps()) {
            patternSigs.add(step.getServiceName() + ":" + step.getHttpMethod() + ":" + step.getPathPattern());
        }

        // Added: in pattern but not in existing workflow
        List<DriftCheckResponseDto.DriftStep> added = new ArrayList<>();
        for (var step : pattern.getSteps()) {
            String sig = step.getServiceName() + ":" + step.getHttpMethod() + ":" + step.getPathPattern();
            if (!existingMap.containsKey(sig)) {
                added.add(DriftCheckResponseDto.DriftStep.builder()
                        .serviceName(step.getServiceName())
                        .method(step.getHttpMethod())
                        .path(step.getPathPattern())
                        .build());
            }
        }

        // Removed: in existing workflow but not in pattern
        List<DriftCheckResponseDto.DriftStep> removed = new ArrayList<>();
        for (var entry : existingMap.entrySet()) {
            if (!patternSigs.contains(entry.getKey())) {
                JsonNode step = entry.getValue();
                removed.add(DriftCheckResponseDto.DriftStep.builder()
                        .serviceName(step.path("serviceName").asText())
                        .method(step.path("httpMethod").asText())
                        .path(step.path("pathPattern").asText())
                        .build());
            }
        }

        return DriftCheckResponseDto.DriftChanges.builder()
                .addedSteps(added)
                .removedSteps(removed)
                .modifiedSteps(Collections.emptyList())
                .build();
    }
}

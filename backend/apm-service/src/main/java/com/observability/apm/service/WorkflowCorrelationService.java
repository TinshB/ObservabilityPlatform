package com.observability.apm.service;

import com.observability.apm.dto.LiveCorrelationResponse;
import com.observability.apm.dto.WorkflowCorrelationRequest;
import com.observability.apm.dto.WorkflowCorrelationResponse;
import com.observability.apm.dto.WorkflowInstanceResponse;
import com.observability.apm.dto.WorkflowInstanceStatsResponse;
import com.observability.apm.entity.WorkflowEntity;
import com.observability.apm.entity.WorkflowInstanceEntity;
import com.observability.apm.entity.WorkflowInstanceStepEntity;
import com.observability.apm.entity.WorkflowStepEntity;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import com.observability.apm.jaeger.JaegerResponse.*;
import com.observability.apm.repository.WorkflowInstanceRepository;
import com.observability.apm.repository.WorkflowInstanceStepRepository;
import com.observability.apm.repository.WorkflowRepository;
import com.observability.apm.repository.WorkflowStepRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.regex.PatternSyntaxException;
import java.util.stream.Collectors;

/**
 * Story 12.3 — Trace-to-workflow correlation engine.
 * Fetches Jaeger traces and matches them against defined business workflow steps.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowCorrelationService {

    private final WorkflowRepository workflowRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final WorkflowInstanceRepository workflowInstanceRepository;
    private final WorkflowInstanceStepRepository workflowInstanceStepRepository;
    private final JaegerClient jaegerClient;

    private static final String TAG_SPAN_KIND   = "span.kind";
    private static final String TAG_HTTP_METHOD  = "http.method";
    private static final String TAG_HTTP_ROUTE   = "http.route";
    private static final String TAG_HTTP_STATUS  = "http.status_code";
    private static final String TAG_ERROR        = "error";

    @Transactional
    public WorkflowCorrelationResponse correlate(WorkflowCorrelationRequest request) {
        // 1. Load active workflows
        List<WorkflowEntity> workflows;
        if (request.getWorkflowId() != null) {
            WorkflowEntity wf = workflowRepository.findById(request.getWorkflowId())
                    .orElseThrow(() -> new ResourceNotFoundException("Workflow", request.getWorkflowId().toString()));
            workflows = List.of(wf);
        } else {
            workflows = workflowRepository.findByEnabledTrueAndActiveTrue();
        }

        if (workflows.isEmpty()) {
            log.info("No active workflows to correlate");
            return WorkflowCorrelationResponse.builder()
                    .workflowsProcessed(0).tracesAnalyzed(0)
                    .instancesCreated(0).instancesUpdated(0)
                    .build();
        }

        // 2. Load ordered steps for each workflow
        Map<UUID, List<WorkflowStepEntity>> workflowStepsMap = new HashMap<>();
        Set<String> allServiceNames = new HashSet<>();
        for (WorkflowEntity wf : workflows) {
            List<WorkflowStepEntity> steps = workflowStepRepository
                    .findByWorkflowIdOrderByStepOrderAsc(wf.getId());
            workflowStepsMap.put(wf.getId(), steps);
            for (WorkflowStepEntity step : steps) {
                allServiceNames.add(step.getServiceName());
            }
        }

        // 3. Fetch traces from Jaeger per service_name, deduplicate by traceId
        int lookbackMinutes = request.getLookbackMinutes() > 0 ? request.getLookbackMinutes() : 60;
        int traceLimit = request.getTraceLimit() > 0 ? request.getTraceLimit() : 50;
        Instant end = Instant.now();
        Instant start = end.minusSeconds((long) lookbackMinutes * 60);

        Map<String, JaegerTrace> uniqueTraces = new LinkedHashMap<>();
        for (String serviceName : allServiceNames) {
            JaegerResponse response = jaegerClient.getTraces(
                    serviceName, null, start, end, null, null, traceLimit, null);
            if (response.getData() != null) {
                for (JaegerTrace trace : response.getData()) {
                    if (trace.getTraceId() != null) {
                        uniqueTraces.putIfAbsent(trace.getTraceId(), trace);
                    }
                }
            }
        }

        log.info("Correlation: {} workflows, {} unique traces from {} services",
                workflows.size(), uniqueTraces.size(), allServiceNames.size());

        // 4. For each trace × each workflow, attempt matching
        int instancesCreated = 0;
        int instancesUpdated = 0;

        for (JaegerTrace trace : uniqueTraces.values()) {
            Map<String, JaegerProcess> processes = trace.getProcesses() != null
                    ? trace.getProcesses() : Map.of();
            List<JaegerSpan> spans = trace.getSpans();
            if (spans == null || spans.isEmpty()) continue;

            // Extract SERVER spans with their attributes
            List<SpanInfo> serverSpans = extractServerSpans(spans, processes);

            for (WorkflowEntity wf : workflows) {
                List<WorkflowStepEntity> steps = workflowStepsMap.get(wf.getId());
                if (steps == null || steps.isEmpty()) continue;

                // Match spans against steps
                List<StepMatch> matches = matchStepsToSpans(steps, serverSpans);

                // If step 1 not matched, skip — not a candidate
                if (matches.isEmpty() || matches.get(0).step.getStepOrder() != steps.get(0).getStepOrder()) {
                    continue;
                }

                // Dedup: check if instance already exists
                Optional<WorkflowInstanceEntity> existingOpt =
                        workflowInstanceRepository.findByWorkflowIdAndTraceId(wf.getId(), trace.getTraceId());

                boolean anyError = matches.stream().anyMatch(m -> m.error);
                String status;
                if (anyError) {
                    status = "FAILED";
                } else if (matches.size() == steps.size()) {
                    status = "COMPLETE";
                } else {
                    status = "IN_PROGRESS";
                }

                // Calculate timing
                long earliestStart = matches.stream()
                        .mapToLong(m -> m.startTimeMicros)
                        .min().orElse(0);
                long latestEnd = matches.stream()
                        .mapToLong(m -> m.startTimeMicros + m.durationMicros)
                        .max().orElse(0);
                long totalDurationMs = (latestEnd - earliestStart) / 1000;

                Instant startedAt = earliestStart > 0
                        ? Instant.ofEpochSecond(earliestStart / 1_000_000, (earliestStart % 1_000_000) * 1000)
                        : null;
                Instant completedAt = "COMPLETE".equals(status) && latestEnd > 0
                        ? Instant.ofEpochSecond(latestEnd / 1_000_000, (latestEnd % 1_000_000) * 1000)
                        : null;

                if (existingOpt.isPresent()) {
                    // Update existing instance
                    WorkflowInstanceEntity instance = existingOpt.get();
                    instance.setStatus(status);
                    instance.setStartedAt(startedAt);
                    instance.setCompletedAt(completedAt);
                    instance.setTotalDurationMs(totalDurationMs);
                    instance.setError(anyError);
                    workflowInstanceRepository.save(instance);
                    instancesUpdated++;
                } else {
                    // Create new instance
                    WorkflowInstanceEntity instance = WorkflowInstanceEntity.builder()
                            .workflowId(wf.getId())
                            .traceId(trace.getTraceId())
                            .status(status)
                            .startedAt(startedAt)
                            .completedAt(completedAt)
                            .totalDurationMs(totalDurationMs)
                            .error(anyError)
                            .build();
                    instance = workflowInstanceRepository.save(instance);

                    // Persist instance step records
                    for (StepMatch match : matches) {
                        WorkflowInstanceStepEntity stepEntity = WorkflowInstanceStepEntity.builder()
                                .instanceId(instance.getId())
                                .stepId(match.step.getId())
                                .spanId(match.spanId)
                                .serviceName(match.serviceName)
                                .operationName(match.operationName)
                                .durationMs(match.durationMicros / 1000)
                                .httpStatus(match.httpStatus)
                                .error(match.error)
                                .startedAt(match.startTimeMicros > 0
                                        ? Instant.ofEpochSecond(
                                                match.startTimeMicros / 1_000_000,
                                                (match.startTimeMicros % 1_000_000) * 1000)
                                        : null)
                                .build();
                        workflowInstanceStepRepository.save(stepEntity);
                    }
                    instancesCreated++;
                }
            }
        }

        log.info("Correlation complete: {} created, {} updated", instancesCreated, instancesUpdated);
        return WorkflowCorrelationResponse.builder()
                .workflowsProcessed(workflows.size())
                .tracesAnalyzed(uniqueTraces.size())
                .instancesCreated(instancesCreated)
                .instancesUpdated(instancesUpdated)
                .build();
    }

    // ── Live correlation (no DB persistence) ────────────────────────────────────

    /**
     * Fetch traces from Jaeger and match against workflow steps on the fly.
     * Returns correlated instances and aggregate stats without persisting to the database.
     */
    public LiveCorrelationResponse correlateLive(UUID workflowId, int lookbackMinutes, int traceLimit) {
        WorkflowEntity workflow = workflowRepository.findById(workflowId)
                .orElseThrow(() -> new ResourceNotFoundException("Workflow", workflowId.toString()));

        List<WorkflowStepEntity> steps = workflowStepRepository
                .findByWorkflowIdOrderByStepOrderAsc(workflowId);

        if (steps.isEmpty()) {
            return LiveCorrelationResponse.builder()
                    .stats(WorkflowInstanceStatsResponse.builder()
                            .workflowId(workflowId).workflowName(workflow.getName()).build())
                    .instances(List.of())
                    .build();
        }

        // Collect unique service names from steps
        Set<String> serviceNames = steps.stream()
                .map(WorkflowStepEntity::getServiceName)
                .collect(Collectors.toSet());

        // Fetch traces from Jaeger
        int lb = lookbackMinutes > 0 ? lookbackMinutes : 60;
        int tl = traceLimit > 0 ? traceLimit : 50;
        Instant end = Instant.now();
        Instant start = end.minusSeconds((long) lb * 60);

        Map<String, JaegerTrace> uniqueTraces = new LinkedHashMap<>();
        for (String svc : serviceNames) {
            JaegerResponse resp = jaegerClient.getTraces(svc, null, start, end, null, null, tl, null);
            if (resp.getData() != null) {
                for (JaegerTrace trace : resp.getData()) {
                    if (trace.getTraceId() != null) {
                        uniqueTraces.putIfAbsent(trace.getTraceId(), trace);
                    }
                }
            }
        }

        log.info("Live correlation: {} unique traces from {} services for workflow {}",
                uniqueTraces.size(), serviceNames.size(), workflow.getName());

        int totalSteps = steps.size();
        List<WorkflowInstanceResponse> instances = new ArrayList<>();

        for (JaegerTrace trace : uniqueTraces.values()) {
            Map<String, JaegerProcess> processes = trace.getProcesses() != null
                    ? trace.getProcesses() : Map.of();
            List<JaegerSpan> spans = trace.getSpans();
            if (spans == null || spans.isEmpty()) continue;

            List<SpanInfo> serverSpans = extractServerSpans(spans, processes);
            List<StepMatch> matches = matchStepsToSpans(steps, serverSpans);

            // Step 1 must match
            if (matches.isEmpty()
                    || matches.get(0).step.getStepOrder() != steps.get(0).getStepOrder()) {
                continue;
            }

            boolean anyError = matches.stream().anyMatch(m -> m.error);
            String status;
            if (anyError) {
                status = "FAILED";
            } else if (matches.size() == totalSteps) {
                status = "COMPLETE";
            } else {
                status = "IN_PROGRESS";
            }

            long earliestStart = matches.stream()
                    .mapToLong(m -> m.startTimeMicros).min().orElse(0);
            long latestEnd = matches.stream()
                    .mapToLong(m -> m.startTimeMicros + m.durationMicros).max().orElse(0);
            long totalDurationMs = (latestEnd - earliestStart) / 1000;

            Instant startedAt = earliestStart > 0
                    ? Instant.ofEpochSecond(earliestStart / 1_000_000,
                            (earliestStart % 1_000_000) * 1000)
                    : null;
            Instant completedAt = "COMPLETE".equals(status) && latestEnd > 0
                    ? Instant.ofEpochSecond(latestEnd / 1_000_000,
                            (latestEnd % 1_000_000) * 1000)
                    : null;

            List<WorkflowInstanceResponse.StepDetail> stepDetails = matches.stream()
                    .map(m -> WorkflowInstanceResponse.StepDetail.builder()
                            .id(UUID.nameUUIDFromBytes(
                                    (trace.getTraceId() + "-" + m.step.getId()).getBytes()))
                            .stepId(m.step.getId())
                            .stepOrder(m.step.getStepOrder())
                            .label(m.step.getLabel())
                            .spanId(m.spanId)
                            .serviceName(m.serviceName)
                            .operationName(m.operationName)
                            .durationMs(m.durationMicros / 1000)
                            .httpStatus(m.httpStatus)
                            .error(m.error)
                            .startedAt(m.startTimeMicros > 0
                                    ? Instant.ofEpochSecond(m.startTimeMicros / 1_000_000,
                                            (m.startTimeMicros % 1_000_000) * 1000)
                                    : null)
                            .build())
                    .toList();

            instances.add(WorkflowInstanceResponse.builder()
                    .id(UUID.nameUUIDFromBytes(trace.getTraceId().getBytes()))
                    .workflowId(workflowId)
                    .workflowName(workflow.getName())
                    .traceId(trace.getTraceId())
                    .status(status)
                    .startedAt(startedAt)
                    .completedAt(completedAt)
                    .totalDurationMs(totalDurationMs)
                    .error(anyError)
                    .matchedSteps(matches.size())
                    .totalSteps(totalSteps)
                    .steps(stepDetails)
                    .createdAt(startedAt)
                    .updatedAt(startedAt)
                    .build());
        }

        // Compute stats from matched instances
        int total = instances.size();
        int complete = (int) instances.stream()
                .filter(i -> "COMPLETE".equals(i.getStatus())).count();
        int inProgress = (int) instances.stream()
                .filter(i -> "IN_PROGRESS".equals(i.getStatus())).count();
        int failed = (int) instances.stream()
                .filter(i -> "FAILED".equals(i.getStatus())).count();
        double successRate = total > 0 ? (complete * 100.0) / total : 0.0;

        long minDuration = 0, maxDuration = 0;
        double avgDuration = 0;
        if (total > 0) {
            LongSummaryStatistics durationStats = instances.stream()
                    .filter(i -> i.getTotalDurationMs() != null && i.getTotalDurationMs() > 0)
                    .mapToLong(WorkflowInstanceResponse::getTotalDurationMs)
                    .summaryStatistics();
            if (durationStats.getCount() > 0) {
                avgDuration = durationStats.getAverage();
                minDuration = durationStats.getMin();
                maxDuration = durationStats.getMax();
            }
        }

        WorkflowInstanceStatsResponse stats = WorkflowInstanceStatsResponse.builder()
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

        return LiveCorrelationResponse.builder()
                .stats(stats)
                .instances(instances)
                .build();
    }

    // ── Internal helpers ─────────────────────────────────────────────────────────

    /**
     * Extract SERVER spans from a trace with parsed attributes.
     */
    private List<SpanInfo> extractServerSpans(List<JaegerSpan> spans,
                                               Map<String, JaegerProcess> processes) {
        List<SpanInfo> result = new ArrayList<>();
        for (JaegerSpan span : spans) {
            Map<String, String> tags = extractTags(span);
            String spanKind = tags.get(TAG_SPAN_KIND);
            if (!"server".equalsIgnoreCase(spanKind)) continue;

            SpanInfo info = new SpanInfo();
            info.spanId = span.getSpanId();
            info.operationName = span.getOperationName();
            info.startTimeMicros = span.getStartTime();
            info.durationMicros = span.getDuration();

            // Service name from process map
            info.serviceName = resolveServiceName(span.getProcessId(), processes);

            // HTTP method: from tag, or parse from operationName ("GET /api/v1/users")
            info.httpMethod = tags.get(TAG_HTTP_METHOD);
            info.httpRoute = tags.get(TAG_HTTP_ROUTE);

            // Fallback: parse operationName for method + route
            if ((info.httpMethod == null || info.httpRoute == null)
                    && span.getOperationName() != null && span.getOperationName().contains(" ")) {
                String[] parts = span.getOperationName().split("\\s+", 2);
                if (info.httpMethod == null) info.httpMethod = parts[0];
                if (info.httpRoute == null) info.httpRoute = parts[1];
            }

            // If still no httpRoute, use operationName as fallback
            if (info.httpRoute == null) {
                info.httpRoute = span.getOperationName();
            }

            // HTTP status
            String statusStr = tags.get(TAG_HTTP_STATUS);
            if (statusStr != null) {
                try {
                    info.httpStatus = Integer.parseInt(statusStr);
                } catch (NumberFormatException ignored) {
                }
            }

            // Error flag
            info.error = "true".equalsIgnoreCase(tags.get(TAG_ERROR))
                    || (info.httpStatus != null && info.httpStatus >= 500);

            result.add(info);
        }
        return result;
    }

    /**
     * Match workflow steps to server spans.
     * Returns matched step→span pairs in step order.
     */
    private List<StepMatch> matchStepsToSpans(List<WorkflowStepEntity> steps,
                                               List<SpanInfo> serverSpans) {
        List<StepMatch> matches = new ArrayList<>();
        Set<String> usedSpanIds = new HashSet<>();

        for (WorkflowStepEntity step : steps) {
            for (SpanInfo span : serverSpans) {
                if (usedSpanIds.contains(span.spanId)) continue;

                if (matchesStep(step, span)) {
                    StepMatch match = new StepMatch();
                    match.step = step;
                    match.spanId = span.spanId;
                    match.serviceName = span.serviceName;
                    match.operationName = span.operationName;
                    match.startTimeMicros = span.startTimeMicros;
                    match.durationMicros = span.durationMicros;
                    match.httpStatus = span.httpStatus;
                    match.error = span.error;
                    usedSpanIds.add(span.spanId);
                    matches.add(match);
                    break;
                }
            }
        }
        return matches;
    }

    /**
     * Check if a span matches a workflow step by service name, HTTP method, and path pattern.
     */
    private boolean matchesStep(WorkflowStepEntity step, SpanInfo span) {
        // Service name match (case-insensitive)
        if (span.serviceName == null
                || !span.serviceName.equalsIgnoreCase(step.getServiceName())) {
            return false;
        }

        // HTTP method match (case-insensitive)
        if (span.httpMethod == null
                || !span.httpMethod.equalsIgnoreCase(step.getHttpMethod())) {
            return false;
        }

        // Path pattern match
        if (span.httpRoute == null) return false;
        return matchPath(step.getPathPattern(), span.httpRoute);
    }

    /**
     * Match a path pattern against a route.
     * If the pattern looks like a regex (starts with ^ or contains metacharacters),
     * use regex matching. Otherwise, use exact or prefix match.
     */
    private boolean matchPath(String pattern, String route) {
        if (pattern == null || route == null) return false;

        boolean isRegex = pattern.startsWith("^")
                || pattern.contains(".*")
                || pattern.contains(".+")
                || pattern.contains("\\d")
                || pattern.contains("[");

        if (isRegex) {
            try {
                return route.matches(pattern);
            } catch (PatternSyntaxException e) {
                log.warn("Invalid regex path pattern '{}': {}", pattern, e.getMessage());
                return false;
            }
        }

        // Exact or prefix match
        return route.equals(pattern) || route.startsWith(pattern);
    }

    private Map<String, String> extractTags(JaegerSpan span) {
        if (span.getTags() == null) return Map.of();
        return span.getTags().stream()
                .filter(t -> t.getKey() != null && t.getValue() != null)
                .collect(Collectors.toMap(
                        JaegerTag::getKey,
                        t -> String.valueOf(t.getValue()),
                        (v1, v2) -> v2
                ));
    }

    private String resolveServiceName(String processId, Map<String, JaegerProcess> processes) {
        if (processId == null || processes == null) return null;
        JaegerProcess process = processes.get(processId);
        return process != null ? process.getServiceName() : null;
    }

    // ── Internal data classes ────────────────────────────────────────────────────

    private static class SpanInfo {
        String spanId;
        String serviceName;
        String operationName;
        String httpMethod;
        String httpRoute;
        Integer httpStatus;
        boolean error;
        long startTimeMicros;
        long durationMicros;
    }

    private static class StepMatch {
        WorkflowStepEntity step;
        String spanId;
        String serviceName;
        String operationName;
        Integer httpStatus;
        boolean error;
        long startTimeMicros;
        long durationMicros;
    }
}

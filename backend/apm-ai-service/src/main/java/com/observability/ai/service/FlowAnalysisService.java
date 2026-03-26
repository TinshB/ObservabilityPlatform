package com.observability.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.observability.ai.client.ApmServiceClient;
import com.observability.ai.dto.*;
import com.observability.ai.entity.*;
import com.observability.ai.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Core AI engine for analyzing distributed traces across selected services,
 * discovering flow patterns, computing per-pattern metrics, and building
 * a directed graph for visualization.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FlowAnalysisService {

    private final ApmServiceClient apmClient;
    private final FlowAnalysisRepository analysisRepo;
    private final FlowPatternRepository patternRepo;
    private final FlowAnalysisPresetRepository presetRepo;

    /**
     * Start an async flow analysis job. Returns immediately with the analysis ID.
     */
    @Transactional
    public FlowAnalysisStartedDto startAnalysis(FlowAnalysisRequestDto request, UUID userId) {
        var entity = FlowAnalysisEntity.builder()
                .userId(userId)
                .status("IN_PROGRESS")
                .serviceIds(request.getServiceIds().stream()
                        .map(UUID::toString).collect(Collectors.joining(",")))
                .timeRangeStart(request.getTimeRangeStart())
                .timeRangeEnd(request.getTimeRangeEnd())
                .operationFilter(request.getOperationFilter())
                .traceSampleLimit(request.getTraceSampleLimit())
                .expiresAt(OffsetDateTime.now().plusHours(24))
                .build();

        entity = analysisRepo.save(entity);
        UUID analysisId = entity.getId();

        // Fire async analysis
        runAnalysisAsync(analysisId, request);

        return FlowAnalysisStartedDto.builder()
                .analysisId(analysisId)
                .status("IN_PROGRESS")
                .estimatedDurationMs(estimateDuration(request))
                .pollUrl("/api/v1/ai/flow-analysis/" + analysisId)
                .build();
    }

    /**
     * Poll for analysis results.
     */
    @Transactional(readOnly = true)
    public FlowAnalysisResponseDto getAnalysis(UUID analysisId) {
        var entity = analysisRepo.findById(analysisId)
                .orElseThrow(() -> new RuntimeException("Analysis not found: " + analysisId));

        var builder = FlowAnalysisResponseDto.builder()
                .analysisId(entity.getId())
                .status(entity.getStatus())
                .completedAt(entity.getCompletedAt())
                .tracesAnalyzed(entity.getTracesAnalyzed() != null ? entity.getTracesAnalyzed() : 0)
                .errorMessage(entity.getErrorMessage());

        if ("COMPLETED".equals(entity.getStatus())) {
            var patterns = patternRepo.findByAnalysisIdOrderByFrequencyDesc(analysisId);
            builder.flowPatterns(patterns.stream().map(this::toPatternDto).toList());
            builder.graph(buildGraph(patterns));
        }

        return builder.build();
    }

    /**
     * Get analysis history for a user.
     */
    @Transactional(readOnly = true)
    public List<FlowAnalysisResponseDto> getAnalysisHistory(UUID userId) {
        return analysisRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(e -> FlowAnalysisResponseDto.builder()
                        .analysisId(e.getId())
                        .status(e.getStatus())
                        .completedAt(e.getCompletedAt())
                        .tracesAnalyzed(e.getTracesAnalyzed() != null ? e.getTracesAnalyzed() : 0)
                        .errorMessage(e.getErrorMessage())
                        .build())
                .toList();
    }

    // ── Async analysis execution ─────────────────────────────────────────────

    @Async
    public void runAnalysisAsync(UUID analysisId, FlowAnalysisRequestDto request) {
        try {
            log.info("Starting flow analysis {} for {} services",
                    analysisId, request.getServiceIds().size());

            // 1. Resolve service names
            Map<UUID, String> serviceNameMap = resolveServiceNames(request.getServiceIds());

            // Update entity with service names
            analysisRepo.findById(analysisId).ifPresent(entity -> {
                entity.setServiceNames(String.join(",", serviceNameMap.values()));
                analysisRepo.save(entity);
            });

            // 2. Fetch traces from all selected services
            List<JsonNode> allTraces = fetchTraces(request, serviceNameMap);
            log.info("Analysis {}: fetched {} traces", analysisId, allTraces.size());

            if (allTraces.isEmpty()) {
                markFailed(analysisId, "No traces found for selected services in the given time range. Try expanding the time range.", 0);
                return;
            }

            // 3. Extract span sequences and cluster into flow patterns
            List<TraceFlow> traceFlows = extractTraceFlows(allTraces, serviceNameMap);
            Map<String, List<TraceFlow>> clustered = clusterByFlowSignature(traceFlows);

            // 4. Build pattern entities with metrics
            var analysis = analysisRepo.findById(analysisId).orElseThrow();
            List<FlowPatternEntity> patternEntities = new ArrayList<>();

            for (var entry : clustered.entrySet()) {
                List<TraceFlow> flows = entry.getValue();
                if (flows.isEmpty()) continue;

                var representative = flows.getFirst();
                var patternEntity = buildPatternEntity(analysis, representative, flows);
                patternEntities.add(patternEntity);
            }

            // Sort by frequency descending
            patternEntities.sort((a, b) -> Integer.compare(b.getFrequency(), a.getFrequency()));

            // Assign names
            for (int i = 0; i < patternEntities.size(); i++) {
                var p = patternEntities.get(i);
                if (p.getName() == null || p.getName().isEmpty()) {
                    p.setName("Flow Pattern " + (i + 1));
                }
            }

            patternRepo.saveAll(patternEntities);

            // 5. Mark completed
            analysis.setStatus("COMPLETED");
            analysis.setTracesAnalyzed(allTraces.size());
            analysis.setCompletedAt(OffsetDateTime.now());
            analysisRepo.save(analysis);

            log.info("Analysis {} completed: {} traces -> {} patterns",
                    analysisId, allTraces.size(), patternEntities.size());

        } catch (Exception e) {
            log.error("Analysis {} failed: {}", analysisId, e.getMessage(), e);
            markFailed(analysisId, e.getMessage(), 0);
        }
    }

    // ── Internal trace processing ────────────────────────────────────────────

    private Map<UUID, String> resolveServiceNames(List<UUID> serviceIds) {
        Map<UUID, String> map = new LinkedHashMap<>();
        for (UUID id : serviceIds) {
            try {
                JsonNode svc = apmClient.getServiceById(id);
                String name = svc.has("name") ? svc.get("name").asText() : id.toString();
                map.put(id, name);
            } catch (Exception e) {
                log.warn("Could not resolve service {}: {}", id, e.getMessage());
                map.put(id, id.toString());
            }
        }
        return map;
    }

    private List<JsonNode> fetchTraces(FlowAnalysisRequestDto request, Map<UUID, String> serviceNameMap) {
        long startMicros = request.getTimeRangeStart().toInstant().toEpochMilli() * 1000;
        long endMicros = request.getTimeRangeEnd().toInstant().toEpochMilli() * 1000;
        int limitPerService = Math.max(50, request.getTraceSampleLimit() / serviceNameMap.size());

        // Collect unique traces across services (deduplicate by traceId)
        Map<String, JsonNode> traceMap = new LinkedHashMap<>();

        for (UUID serviceId : serviceNameMap.keySet()) {
            try {
                JsonNode traces = apmClient.getTraces(serviceId, request.getOperationFilter(),
                        startMicros, endMicros, limitPerService, null);
                if (traces != null && traces.isArray()) {
                    for (JsonNode trace : traces) {
                        String traceId = extractTraceId(trace);
                        if (traceId != null && !traceMap.containsKey(traceId)) {
                            traceMap.put(traceId, trace);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to fetch traces for service {}: {}", serviceId, e.getMessage());
            }
        }

        // Cap at sample limit
        return traceMap.values().stream()
                .limit(request.getTraceSampleLimit())
                .toList();
    }

    private String extractTraceId(JsonNode trace) {
        if (trace.has("traceID")) return trace.get("traceID").asText();
        if (trace.has("traceId")) return trace.get("traceId").asText();
        if (trace.has("spans") && trace.get("spans").isArray() && !trace.get("spans").isEmpty()) {
            var firstSpan = trace.get("spans").get(0);
            if (firstSpan.has("traceID")) return firstSpan.get("traceID").asText();
        }
        return null;
    }

    /**
     * Extract flow sequences from raw Jaeger traces.
     * A flow is an ordered sequence of service calls within a single trace.
     */
    private List<TraceFlow> extractTraceFlows(List<JsonNode> traces, Map<UUID, String> selectedServices) {
        Set<String> selectedNames = new HashSet<>(selectedServices.values());
        List<TraceFlow> flows = new ArrayList<>();

        for (JsonNode trace : traces) {
            try {
                TraceFlow flow = extractSingleTraceFlow(trace, selectedNames);
                if (flow != null && flow.steps.size() >= 2) {
                    flows.add(flow);
                }
            } catch (Exception e) {
                log.debug("Failed to extract flow from trace: {}", e.getMessage());
            }
        }
        return flows;
    }

    private TraceFlow extractSingleTraceFlow(JsonNode trace, Set<String> selectedNames) {
        JsonNode spans = trace.has("spans") ? trace.get("spans") : trace;
        if (!spans.isArray() || spans.isEmpty()) return null;

        // Build process map (processId -> serviceName) from Jaeger format
        Map<String, String> processMap = new HashMap<>();
        if (trace.has("processes")) {
            trace.get("processes").fields().forEachRemaining(entry -> {
                JsonNode proc = entry.getValue();
                if (proc.has("serviceName")) {
                    processMap.put(entry.getKey(), proc.get("serviceName").asText());
                }
            });
        }

        // Build span tree: parentSpanId -> list of child spans
        Map<String, List<JsonNode>> childMap = new HashMap<>();
        Map<String, JsonNode> spanMap = new HashMap<>();
        JsonNode rootSpan = null;

        for (JsonNode span : spans) {
            String spanId = getSpanField(span, "spanID", "spanId");
            if (spanId != null) spanMap.put(spanId, span);

            String parentId = findParentSpanId(span);
            if (parentId != null && !parentId.isEmpty()) {
                childMap.computeIfAbsent(parentId, k -> new ArrayList<>()).add(span);
            } else {
                rootSpan = span;
            }
        }

        if (rootSpan == null && !spans.isEmpty()) {
            rootSpan = spans.get(0);
        }

        // DFS to build ordered step sequence
        TraceFlow flow = new TraceFlow();
        flow.traceId = extractTraceId(trace);
        flow.steps = new ArrayList<>();
        flow.totalDurationMicros = 0;
        flow.hasError = false;

        Set<String> visitedServices = new HashSet<>();
        buildFlowSteps(rootSpan, childMap, processMap, selectedNames, flow, visitedServices);

        // Compute total duration from root span
        if (rootSpan != null && rootSpan.has("duration")) {
            flow.totalDurationMicros = rootSpan.get("duration").asLong();
        }

        return flow;
    }

    private void buildFlowSteps(JsonNode span, Map<String, List<JsonNode>> childMap,
                                 Map<String, String> processMap, Set<String> selectedNames,
                                 TraceFlow flow, Set<String> visited) {
        if (span == null) return;

        String serviceName = resolveServiceName(span, processMap);
        String spanKind = getTagValue(span, "span.kind");
        String httpMethod = getTagValue(span, "http.method");
        String httpRoute = getTagValue(span, "http.route");
        if (httpRoute == null) httpRoute = getTagValue(span, "http.url");
        String httpStatusStr = getTagValue(span, "http.status_code");
        boolean isError = "true".equals(getTagValue(span, "error"));
        long duration = span.has("duration") ? span.get("duration").asLong() : 0;

        // Include span if it's a SERVER span from a selected service, or an entry point
        boolean isServerSpan = "server".equalsIgnoreCase(spanKind) || spanKind == null;
        String stepKey = serviceName + ":" + httpMethod + ":" + httpRoute;

        if (serviceName != null && selectedNames.contains(serviceName) && isServerSpan
                && !visited.contains(stepKey)) {
            visited.add(stepKey);

            FlowStep step = new FlowStep();
            step.serviceName = serviceName;
            step.serviceType = inferServiceType(span, processMap);
            step.httpMethod = httpMethod;
            step.httpPath = httpRoute;
            step.durationMicros = duration;
            step.isError = isError;
            if (httpStatusStr != null) {
                try { step.httpStatus = Integer.parseInt(httpStatusStr); } catch (NumberFormatException ignored) {}
            }
            flow.steps.add(step);
            if (isError) flow.hasError = true;
        }

        // Also detect database / external calls within this span's children
        String spanId = getSpanField(span, "spanID", "spanId");
        List<JsonNode> children = childMap.getOrDefault(spanId, Collections.emptyList());

        // Sort children by start time
        children.sort(Comparator.comparingLong(s -> s.has("startTime") ? s.get("startTime").asLong() : 0));

        for (JsonNode child : children) {
            buildFlowSteps(child, childMap, processMap, selectedNames, flow, visited);
        }
    }

    private String resolveServiceName(JsonNode span, Map<String, String> processMap) {
        // Try process map first (Jaeger format)
        String processId = span.has("processID") ? span.get("processID").asText() : null;
        if (processId != null && processMap.containsKey(processId)) {
            return processMap.get(processId);
        }
        // Try direct service.name tag
        String svcName = getTagValue(span, "service.name");
        if (svcName != null) return svcName;
        // Try resource attributes
        if (span.has("process") && span.get("process").has("serviceName")) {
            return span.get("process").get("serviceName").asText();
        }
        return null;
    }

    private String inferServiceType(JsonNode span, Map<String, String> processMap) {
        String dbSystem = getTagValue(span, "db.system");
        if (dbSystem != null) return "DATABASE";

        String messagingSystem = getTagValue(span, "messaging.system");
        if (messagingSystem != null) return "QUEUE";

        String rpcSystem = getTagValue(span, "rpc.system");
        if (rpcSystem != null) return "BACKEND";

        String component = getTagValue(span, "component");
        if ("net/http".equals(component) || "spring".equals(component)) return "BACKEND";

        // Default
        return "BACKEND";
    }

    private String findParentSpanId(JsonNode span) {
        if (span.has("references") && span.get("references").isArray()) {
            for (JsonNode ref : span.get("references")) {
                if ("CHILD_OF".equals(ref.path("refType").asText())) {
                    return ref.path("spanID").asText(null);
                }
            }
        }
        if (span.has("parentSpanId")) return span.get("parentSpanId").asText(null);
        return null;
    }

    private String getSpanField(JsonNode span, String... names) {
        for (String name : names) {
            if (span.has(name)) return span.get(name).asText();
        }
        return null;
    }

    private String getTagValue(JsonNode span, String key) {
        if (span.has("tags") && span.get("tags").isArray()) {
            for (JsonNode tag : span.get("tags")) {
                if (key.equals(tag.path("key").asText())) {
                    return tag.path("value").asText(null);
                }
            }
        }
        // Also check flat attributes
        if (span.has("attributes") && span.get("attributes").has(key)) {
            return span.get("attributes").get(key).asText();
        }
        return null;
    }

    // ── Clustering ───────────────────────────────────────────────────────────

    /**
     * Cluster traces by their service call sequence signature.
     * Signature = ordered list of "service:method:path" for each step.
     */
    private Map<String, List<TraceFlow>> clusterByFlowSignature(List<TraceFlow> flows) {
        Map<String, List<TraceFlow>> clusters = new LinkedHashMap<>();
        for (TraceFlow flow : flows) {
            String signature = flow.steps.stream()
                    .map(s -> s.serviceName + ":" + s.httpMethod + ":" + normalizePath(s.httpPath))
                    .collect(Collectors.joining(" -> "));
            clusters.computeIfAbsent(signature, k -> new ArrayList<>()).add(flow);
        }
        return clusters;
    }

    /**
     * Normalize paths by replacing UUID/numeric segments with placeholders.
     */
    private String normalizePath(String path) {
        if (path == null) return "";
        return path
                .replaceAll("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "{id}")
                .replaceAll("/\\d+", "/{id}");
    }

    // ── Pattern building ─────────────────────────────────────────────────────

    private FlowPatternEntity buildPatternEntity(FlowAnalysisEntity analysis,
                                                  TraceFlow representative,
                                                  List<TraceFlow> flows) {
        var pattern = FlowPatternEntity.builder()
                .analysis(analysis)
                .frequency(flows.size())
                .build();

        // Compute latency statistics
        List<Long> durations = flows.stream()
                .map(f -> f.totalDurationMicros / 1000)  // convert to ms
                .sorted()
                .toList();

        if (!durations.isEmpty()) {
            pattern.setAvgLatencyMs(durations.stream().mapToLong(Long::longValue).average().orElse(0));
            pattern.setP50LatencyMs(percentile(durations, 50));
            pattern.setP95LatencyMs(percentile(durations, 95));
            pattern.setP99LatencyMs(percentile(durations, 99));
        }

        // Error rate
        long errorCount = flows.stream().filter(f -> f.hasError).count();
        pattern.setErrorRate((double) errorCount / flows.size());

        // Sample trace IDs (up to 10)
        pattern.setSampleTraceIds(flows.stream()
                .limit(10)
                .map(f -> f.traceId)
                .filter(Objects::nonNull)
                .collect(Collectors.joining(",")));

        // Build name from service sequence
        String name = representative.steps.stream()
                .map(s -> s.serviceName)
                .distinct()
                .collect(Collectors.joining(" -> "));
        if (name.length() > 250) name = name.substring(0, 250);
        pattern.setName(name);

        // Build steps
        List<FlowPatternStepEntity> stepEntities = new ArrayList<>();
        for (int i = 0; i < representative.steps.size(); i++) {
            FlowStep step = representative.steps.get(i);

            // Compute per-step avg latency across all flows in this cluster
            final int stepIndex = i;
            double stepAvgLatency = flows.stream()
                    .filter(f -> f.steps.size() > stepIndex)
                    .mapToLong(f -> f.steps.get(stepIndex).durationMicros / 1000)
                    .average().orElse(0);
            double stepErrorRate = flows.stream()
                    .filter(f -> f.steps.size() > stepIndex)
                    .mapToDouble(f -> f.steps.get(stepIndex).isError ? 1.0 : 0.0)
                    .average().orElse(0);

            stepEntities.add(FlowPatternStepEntity.builder()
                    .pattern(pattern)
                    .stepOrder(i + 1)
                    .serviceName(step.serviceName)
                    .serviceType(step.serviceType)
                    .httpMethod(step.httpMethod)
                    .pathPattern(normalizePath(step.httpPath))
                    .avgLatencyMs(stepAvgLatency)
                    .errorRate(stepErrorRate)
                    .build());
        }
        pattern.setSteps(stepEntities);

        // Build edges (consecutive step pairs)
        List<FlowPatternEdgeEntity> edgeEntities = new ArrayList<>();
        for (int i = 0; i < representative.steps.size() - 1; i++) {
            FlowStep from = representative.steps.get(i);
            FlowStep to = representative.steps.get(i + 1);

            edgeEntities.add(FlowPatternEdgeEntity.builder()
                    .pattern(pattern)
                    .sourceService(from.serviceName)
                    .targetService(to.serviceName)
                    .callCount(flows.size())
                    .avgLatencyMs(stepEntities.get(i + 1).getAvgLatencyMs())
                    .errorRate(stepEntities.get(i + 1).getErrorRate())
                    .httpMethod(to.httpMethod)
                    .httpPath(normalizePath(to.httpPath))
                    .build());
        }
        pattern.setEdges(edgeEntities);

        return pattern;
    }

    private double percentile(List<Long> sorted, int p) {
        if (sorted.isEmpty()) return 0;
        int index = (int) Math.ceil(p / 100.0 * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(index, sorted.size() - 1)));
    }

    // ── Graph building ───────────────────────────────────────────────────────

    private FlowAnalysisResponseDto.FlowGraphDto buildGraph(List<FlowPatternEntity> patterns) {
        Map<String, FlowAnalysisResponseDto.FlowNodeDto> nodeMap = new LinkedHashMap<>();
        Map<String, FlowAnalysisResponseDto.FlowEdgeDto> edgeMap = new LinkedHashMap<>();

        for (var pattern : patterns) {
            for (var step : pattern.getSteps()) {
                nodeMap.computeIfAbsent(step.getServiceName(), k ->
                    FlowAnalysisResponseDto.FlowNodeDto.builder()
                            .id(k)
                            .label(k)
                            .type(step.getServiceType())
                            .metrics(FlowAnalysisResponseDto.NodeMetricsDto.builder()
                                    .totalCalls(pattern.getFrequency())
                                    .avgLatencyMs(step.getAvgLatencyMs() != null ? step.getAvgLatencyMs() : 0)
                                    .errorRate(step.getErrorRate())
                                    .build())
                            .build()
                );
            }

            for (var edge : pattern.getEdges()) {
                String key = edge.getSourceService() + "->" + edge.getTargetService();
                edgeMap.merge(key,
                    FlowAnalysisResponseDto.FlowEdgeDto.builder()
                            .source(edge.getSourceService())
                            .target(edge.getTargetService())
                            .callCount(edge.getCallCount())
                            .avgLatencyMs(edge.getAvgLatencyMs() != null ? edge.getAvgLatencyMs() : 0)
                            .errorRate(edge.getErrorRate())
                            .httpMethod(edge.getHttpMethod())
                            .httpPath(edge.getHttpPath())
                            .build(),
                    (existing, incoming) -> {
                        existing.setCallCount(existing.getCallCount() + incoming.getCallCount());
                        return existing;
                    }
                );
            }
        }

        return FlowAnalysisResponseDto.FlowGraphDto.builder()
                .nodes(new ArrayList<>(nodeMap.values()))
                .edges(new ArrayList<>(edgeMap.values()))
                .build();
    }

    // ── DTO mapping ──────────────────────────────────────────────────────────

    private FlowPatternDto toPatternDto(FlowPatternEntity entity) {
        return FlowPatternDto.builder()
                .patternId(entity.getId())
                .name(entity.getName())
                .frequency(entity.getFrequency())
                .avgLatencyMs(entity.getAvgLatencyMs() != null ? entity.getAvgLatencyMs() : 0)
                .p50LatencyMs(entity.getP50LatencyMs())
                .p95LatencyMs(entity.getP95LatencyMs())
                .p99LatencyMs(entity.getP99LatencyMs())
                .errorRate(entity.getErrorRate())
                .sampleTraceIds(entity.getSampleTraceIds() != null
                        ? Arrays.asList(entity.getSampleTraceIds().split(","))
                        : Collections.emptyList())
                .steps(entity.getSteps().stream()
                        .map(s -> FlowPatternStepDto.builder()
                                .order(s.getStepOrder())
                                .serviceName(s.getServiceName())
                                .serviceType(s.getServiceType())
                                .method(s.getHttpMethod())
                                .path(s.getPathPattern())
                                .avgLatencyMs(s.getAvgLatencyMs() != null ? s.getAvgLatencyMs() : 0)
                                .errorRate(s.getErrorRate())
                                .build())
                        .toList())
                .edges(entity.getEdges().stream()
                        .map(e -> FlowPatternEdgeDto.builder()
                                .source(e.getSourceService())
                                .target(e.getTargetService())
                                .callCount(e.getCallCount())
                                .avgLatencyMs(e.getAvgLatencyMs() != null ? e.getAvgLatencyMs() : 0)
                                .errorRate(e.getErrorRate())
                                .httpMethod(e.getHttpMethod())
                                .httpPath(e.getHttpPath())
                                .build())
                        .toList())
                .build();
    }

    // ── Presets ──────────────────────────────────────────────────────────────

    @Transactional
    public FlowAnalysisPresetDto createPreset(CreatePresetRequestDto request, UUID userId) {
        var entity = FlowAnalysisPresetEntity.builder()
                .userId(userId)
                .name(request.getName())
                .serviceIds(request.getServiceIds().stream()
                        .map(UUID::toString).collect(Collectors.joining(",")))
                .defaultTimeRangeMinutes(request.getDefaultTimeRangeMinutes())
                .build();
        entity = presetRepo.save(entity);
        return toPresetDto(entity);
    }

    @Transactional(readOnly = true)
    public List<FlowAnalysisPresetDto> getPresets(UUID userId) {
        return presetRepo.findByUserIdOrderByNameAsc(userId).stream()
                .map(this::toPresetDto)
                .toList();
    }

    @Transactional
    public void deletePreset(UUID presetId) {
        presetRepo.deleteById(presetId);
    }

    private FlowAnalysisPresetDto toPresetDto(FlowAnalysisPresetEntity entity) {
        return FlowAnalysisPresetDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .serviceIds(Arrays.stream(entity.getServiceIds().split(","))
                        .map(UUID::fromString)
                        .toList())
                .defaultTimeRangeMinutes(entity.getDefaultTimeRangeMinutes())
                .build();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void markFailed(UUID analysisId, String message, int tracesAnalyzed) {
        analysisRepo.findById(analysisId).ifPresent(e -> {
            e.setStatus("FAILED");
            e.setErrorMessage(message != null && message.length() > 1000
                    ? message.substring(0, 1000) : message);
            e.setTracesAnalyzed(tracesAnalyzed);
            e.setCompletedAt(OffsetDateTime.now());
            analysisRepo.save(e);
        });
    }

    private long estimateDuration(FlowAnalysisRequestDto request) {
        return Math.min(30000, request.getServiceIds().size() * 2000L
                + request.getTraceSampleLimit() * 5L);
    }

    // ── Internal models ──────────────────────────────────────────────────────

    static class TraceFlow {
        String traceId;
        List<FlowStep> steps;
        long totalDurationMicros;
        boolean hasError;
    }

    static class FlowStep {
        String serviceName;
        String serviceType;
        String httpMethod;
        String httpPath;
        long durationMicros;
        int httpStatus;
        boolean isError;
    }
}

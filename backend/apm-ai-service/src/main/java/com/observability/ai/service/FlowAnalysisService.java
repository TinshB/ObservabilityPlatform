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

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.StreamSupport;
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

        // Capture JWT token from current request before going async
        String authToken = captureAuthToken();

        // Fire async analysis
        runAnalysisAsync(analysisId, request, authToken);

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
    public void runAnalysisAsync(UUID analysisId, FlowAnalysisRequestDto request, String authToken) {
        // Set auth token for this async thread so ApmServiceClient can use it
        if (authToken != null) {
            apmClient.setAuthToken(authToken);
        }
        try {
            log.info("Starting flow analysis {} for {} services",
                    analysisId, request.getServiceIds().size());

            // 1. Resolve service names (best-effort — may fall back to UUIDs)
            Map<UUID, String> serviceNameMap = resolveServiceNames(request.getServiceIds());

            // 2. Fetch traces from all selected services
            List<JsonNode> allTraces = fetchTraces(request, serviceNameMap);
            log.info("Analysis {}: fetched {} traces", analysisId, allTraces.size());

            if (allTraces.isEmpty()) {
                markFailed(analysisId, "No traces found for selected services in the given time range. Try expanding the time range.", 0);
                return;
            }

            // 3. Collect actual service names from the traces themselves
            //    (more reliable than Service Catalog which may return 500)
            Set<String> traceServiceNames = collectServiceNamesFromTraces(allTraces);
            log.info("Analysis {}: services found in traces: {}", analysisId, traceServiceNames);

            // Update entity with discovered service names
            analysisRepo.findById(analysisId).ifPresent(entity -> {
                entity.setServiceNames(String.join(",", traceServiceNames));
                analysisRepo.save(entity);
            });

            // 4. Extract span sequences and cluster into flow patterns
            //    Use ALL service names from traces (no filtering — traces are already scoped)
            List<TraceFlow> traceFlows = extractTraceFlows(allTraces, traceServiceNames);
            log.info("Analysis {}: extracted {} trace flows from {} traces",
                    analysisId, traceFlows.size(), allTraces.size());

            if (traceFlows.isEmpty()) {
                log.warn("Analysis {}: no trace flows extracted. Check if service names in " +
                        "Service Catalog match service names in Jaeger traces.", analysisId);
            }

            Map<String, List<TraceFlow>> clustered = clusterByFlowSignature(traceFlows);
            log.info("Analysis {}: clustered into {} distinct patterns", analysisId, clustered.size());

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
        } finally {
            apmClient.clearAuthToken();
        }
    }

    private String captureAuthToken() {
        try {
            var attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes servletAttrs) {
                HttpServletRequest req = servletAttrs.getRequest();
                return req.getHeader("Authorization");
            }
        } catch (Exception ignored) {}
        return null;
    }

    // ── Internal trace processing ────────────────────────────────────────────

    /**
     * Collect all unique service names from the 'services' field of TraceDetailResponse.
     * This is more reliable than the Service Catalog API.
     */
    private Set<String> collectServiceNamesFromTraces(List<JsonNode> traces) {
        Set<String> names = new LinkedHashSet<>();
        for (JsonNode trace : traces) {
            // TraceDetailResponse has a top-level "services" array
            JsonNode services = trace.path("services");
            if (services.isArray()) {
                for (JsonNode svc : services) {
                    String name = svc.asText(null);
                    if (name != null && !name.isBlank()) {
                        names.add(name);
                    }
                }
            }
            // Also collect from spans directly as fallback
            JsonNode spans = trace.path("spans");
            if (spans.isArray()) {
                for (JsonNode span : spans) {
                    String sn = span.path("serviceName").asText(null);
                    if (sn != null && !sn.isBlank()) {
                        names.add(sn);
                    }
                }
            }
        }
        return names;
    }

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
        var startInstant = request.getTimeRangeStart().toInstant();
        var endInstant = request.getTimeRangeEnd().toInstant();
        // apm-service caps limit at 100 per call
        int limitPerService = Math.min(100, Math.max(20, request.getTraceSampleLimit() / serviceNameMap.size()));

        // Step 1: Collect unique trace IDs from all services (search returns TraceSummary, not full data)
        Map<String, JsonNode> traceSummaryMap = new LinkedHashMap<>();

        for (UUID serviceId : serviceNameMap.keySet()) {
            try {
                JsonNode response = apmClient.getTraces(serviceId, request.getOperationFilter(),
                        startInstant, endInstant, limitPerService, null);

                // Response is TraceSearchResponse: { traces: [...], total, limit }
                JsonNode traces = response;
                if (response.has("traces")) {
                    traces = response.get("traces");
                }

                if (traces != null && traces.isArray()) {
                    for (JsonNode traceSummary : traces) {
                        String traceId = traceSummary.has("traceId")
                                ? traceSummary.get("traceId").asText()
                                : traceSummary.has("traceID") ? traceSummary.get("traceID").asText() : null;
                        if (traceId != null && !traceSummaryMap.containsKey(traceId)) {
                            traceSummaryMap.put(traceId, traceSummary);
                        }
                    }
                }
                log.debug("Service {}: found {} trace summaries", serviceId, traces != null ? traces.size() : 0);
            } catch (Exception e) {
                log.warn("Failed to fetch traces for service {}: {}", serviceId, e.getMessage());
            }
        }

        log.info("Collected {} unique trace IDs from {} services",
                traceSummaryMap.size(), serviceNameMap.size());

        // Step 2: Fetch full trace detail (with spans) for each trace ID
        List<JsonNode> fullTraces = new ArrayList<>();
        int fetchLimit = Math.min(traceSummaryMap.size(), request.getTraceSampleLimit());
        int fetched = 0;

        for (String traceId : traceSummaryMap.keySet()) {
            if (fetched >= fetchLimit) break;
            try {
                JsonNode traceDetail = apmClient.getTraceDetail(traceId);
                if (traceDetail != null && !traceDetail.isNull()) {
                    fullTraces.add(traceDetail);
                    fetched++;
                }
            } catch (Exception e) {
                log.debug("Failed to fetch trace detail for {}: {}", traceId, e.getMessage());
            }
        }

        log.info("Fetched {} full trace details", fullTraces.size());

        // Diagnostic: log structure of first trace to verify field names
        if (!fullTraces.isEmpty()) {
            JsonNode first = fullTraces.get(0);
            log.info("Sample trace structure — traceId: {}, spanCount field: {}, " +
                            "services field: {}, has spans: {}, spans count: {}",
                    first.path("traceId").asText("MISSING"),
                    first.path("spanCount").asText("MISSING"),
                    first.path("services"),
                    first.has("spans"),
                    first.has("spans") ? first.get("spans").size() : 0);

            if (first.has("spans") && first.get("spans").size() > 0) {
                JsonNode firstSpan = first.get("spans").get(0);
                log.info("Sample span — serviceName: '{}', operationName: '{}', " +
                                "httpMethod: '{}', httpUrl: '{}', spanId: '{}', parentSpanId: '{}', " +
                                "tags type: {}, all fields: {}",
                        firstSpan.path("serviceName").asText("MISSING"),
                        firstSpan.path("operationName").asText("MISSING"),
                        firstSpan.path("httpMethod").asText("MISSING"),
                        firstSpan.path("httpUrl").asText("MISSING"),
                        firstSpan.path("spanId").asText("MISSING"),
                        firstSpan.path("parentSpanId").asText("MISSING"),
                        firstSpan.has("tags") ? firstSpan.get("tags").getNodeType() : "MISSING",
                        firstSpan.fieldNames().hasNext() ?
                                StreamSupport.stream(
                                    Spliterators.spliteratorUnknownSize(firstSpan.fieldNames(), 0), false)
                                    .collect(Collectors.joining(", ")) : "none");
            }
        }

        return fullTraces;
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
     * Extract flow sequences from trace details.
     * A flow is an ordered sequence of service calls within a single trace.
     */
    private List<TraceFlow> extractTraceFlows(List<JsonNode> traces, Set<String> serviceNames) {
        // Build a case-insensitive set of service names
        Set<String> selectedNamesLower = new HashSet<>();
        for (String name : serviceNames) {
            selectedNamesLower.add(name.toLowerCase());
        }

        List<TraceFlow> flows = new ArrayList<>();
        int skippedNoSpans = 0, skippedNoSteps = 0, skippedSingleStep = 0;
        Set<String> allSpanServiceNames = new HashSet<>();

        for (JsonNode trace : traces) {
            try {
                TraceFlow flow = extractSingleTraceFlow(trace, selectedNamesLower, allSpanServiceNames);
                if (flow == null) {
                    skippedNoSpans++;
                } else if (flow.steps.isEmpty()) {
                    skippedNoSteps++;
                } else if (flow.steps.size() < 2) {
                    // Include single-step flows too — they represent entry points
                    flows.add(flow);
                    skippedSingleStep++;
                } else {
                    flows.add(flow);
                }
            } catch (Exception e) {
                log.debug("Failed to extract flow from trace: {}", e.getMessage());
            }
        }

        log.info("Flow extraction: {} traces -> {} flows ({} no-spans, {} no-matching-steps, {} single-step). " +
                        "Selected services (lowercase): {}. Service names found in spans: {}",
                traces.size(), flows.size(), skippedNoSpans, skippedNoSteps, skippedSingleStep,
                selectedNamesLower, allSpanServiceNames);

        return flows;
    }

    /**
     * Extract flow from a TraceDetailResponse (custom DTO, not raw Jaeger).
     * Each span has: spanId, parentSpanId, serviceName, operationName,
     * httpMethod, httpUrl, httpStatusCode, hasError, durationMicros, tags (Map).
     */
    private TraceFlow extractSingleTraceFlow(JsonNode trace, Set<String> selectedNamesLower,
                                              Set<String> allSpanServiceNames) {
        JsonNode spans = trace.has("spans") ? trace.get("spans") : null;
        if (spans == null || !spans.isArray() || spans.isEmpty()) return null;

        // Collect all service names from this trace for diagnostics
        for (JsonNode span : spans) {
            String sn = span.path("serviceName").asText(null);
            if (sn != null) allSpanServiceNames.add(sn);
        }

        // Build span tree: parentSpanId -> list of child spans
        Map<String, List<JsonNode>> childMap = new HashMap<>();
        JsonNode rootSpan = null;

        for (JsonNode span : spans) {
            String parentId = span.path("parentSpanId").asText(null);

            if (parentId != null && !parentId.isEmpty()) {
                childMap.computeIfAbsent(parentId, k -> new ArrayList<>()).add(span);
            } else {
                rootSpan = span;
            }
        }

        if (rootSpan == null) rootSpan = spans.get(0);

        // DFS to build ordered step sequence
        TraceFlow flow = new TraceFlow();
        flow.traceId = trace.path("traceId").asText(null);
        flow.steps = new ArrayList<>();
        flow.totalDurationMicros = trace.path("durationMicros").asLong(0);
        flow.hasError = false;

        Set<String> visitedSteps = new HashSet<>();
        buildFlowSteps(rootSpan, childMap, selectedNamesLower, flow, visitedSteps);

        return flow;
    }

    private void buildFlowSteps(JsonNode span, Map<String, List<JsonNode>> childMap,
                                 Set<String> selectedNamesLower,
                                 TraceFlow flow, Set<String> visited) {
        if (span == null) return;

        // TraceDetailResponse SpanDetail fields
        String serviceName = span.path("serviceName").asText(null);
        String httpMethod = span.path("httpMethod").asText(null);
        String httpUrl = span.path("httpUrl").asText(null);
        String operationName = span.path("operationName").asText(null);
        // Try tags for http.route (more useful as a pattern than full URL)
        String httpRoute = getTagValue(span, "http.route");
        if (httpRoute == null) httpRoute = getTagValue(span, "http.target");
        if (httpRoute == null) httpRoute = httpUrl;
        // If still null, derive from operationName (often "GET /api/v1/...")
        if (httpRoute == null && operationName != null && operationName.contains("/")) {
            httpRoute = operationName.contains(" ")
                    ? operationName.substring(operationName.indexOf(' ') + 1)
                    : operationName;
        }
        if (httpMethod == null && operationName != null && operationName.contains(" ")) {
            httpMethod = operationName.substring(0, operationName.indexOf(' '));
        }
        boolean hasError = span.path("hasError").asBoolean(false);
        long durationMicros = span.path("durationMicros").asLong(0);
        int httpStatusCode = span.path("httpStatusCode").asInt(0);

        // Case-insensitive service name matching
        boolean isSelectedService = serviceName != null
                && selectedNamesLower.contains(serviceName.toLowerCase());

        String stepKey = (serviceName != null ? serviceName.toLowerCase() : "")
                + ":" + httpMethod + ":" + httpRoute;

        if (isSelectedService && !visited.contains(stepKey)) {
            visited.add(stepKey);

            FlowStep step = new FlowStep();
            step.serviceName = serviceName;
            step.serviceType = inferServiceType(span);
            step.httpMethod = httpMethod;
            step.httpPath = httpRoute;
            step.durationMicros = durationMicros;
            step.isError = hasError;
            step.httpStatus = httpStatusCode;
            flow.steps.add(step);
            if (hasError) flow.hasError = true;
        }

        // Recurse into children
        String spanId = span.path("spanId").asText(null);
        List<JsonNode> children = childMap.getOrDefault(spanId, Collections.emptyList());
        children.sort(Comparator.comparingLong(s -> s.path("startTime").asLong(0)));

        for (JsonNode child : children) {
            buildFlowSteps(child, childMap, selectedNamesLower, flow, visited);
        }
    }

    private String inferServiceType(JsonNode span) {
        String dbSystem = getTagValue(span, "db.system");
        if (dbSystem != null) return "DATABASE";

        String messagingSystem = getTagValue(span, "messaging.system");
        if (messagingSystem != null) return "QUEUE";

        return "BACKEND";
    }

    /**
     * Get a tag value from the SpanDetail's tags map (Map&lt;String,String&gt;)
     * or from the Jaeger-style tags array.
     */
    private String getTagValue(JsonNode span, String key) {
        JsonNode tags = span.path("tags");
        // Custom DTO format: tags is a JSON object (Map<String,String>)
        if (tags.isObject() && tags.has(key)) {
            return tags.get(key).asText(null);
        }
        // Jaeger raw format fallback: tags is an array of {key, type, value}
        if (tags.isArray()) {
            for (JsonNode tag : tags) {
                if (key.equals(tag.path("key").asText())) {
                    return tag.path("value").asText(null);
                }
            }
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

package com.observability.apm.service;

import com.observability.apm.dto.DependencyGraphResponse;
import com.observability.apm.dto.DependencyGraphResponse.DependencyEdge;
import com.observability.apm.dto.DependencyGraphResponse.DependencyNode;
import com.observability.apm.dto.DependencyResponse;
import com.observability.apm.entity.DependencyEntity;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import com.observability.apm.jaeger.JaegerResponse.*;
import com.observability.apm.repository.DependencyRepository;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Story 11.3 — Dependency extraction service.
 * Parses Jaeger trace spans for OpenTelemetry semantic attributes (peer.service,
 * db.system, rpc.method, net.peer.name) to build a service dependency graph.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DependencyService {

    private final DependencyRepository dependencyRepository;
    private final ServiceRepository serviceRepository;
    private final JaegerClient jaegerClient;

    // ── OTel semantic convention tag keys ───────────────────────────────────────
    private static final String TAG_PEER_SERVICE   = "peer.service";
    private static final String TAG_DB_SYSTEM      = "db.system";
    private static final String TAG_DB_NAME        = "db.name";
    private static final String TAG_NET_PEER_NAME  = "net.peer.name";
    private static final String TAG_RPC_SYSTEM     = "rpc.system";
    private static final String TAG_RPC_SERVICE    = "rpc.service";
    private static final String TAG_HTTP_URL       = "http.url";
    private static final String TAG_SPAN_KIND      = "span.kind";
    private static final String TAG_ERROR          = "error";

    // ── Read operations ────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DependencyResponse> getDependencies(UUID serviceId) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        return dependencyRepository.findBySourceServiceIdAndActiveTrue(serviceId).stream()
                .map(entity -> toResponse(entity, service.getName()))
                .toList();
    }

    @Transactional(readOnly = true)
    public DependencyResponse getDependency(UUID dependencyId) {
        DependencyEntity entity = dependencyRepository.findById(dependencyId)
                .orElseThrow(() -> new ResourceNotFoundException("Dependency", dependencyId.toString()));
        String sourceName = serviceRepository.findById(entity.getSourceServiceId())
                .map(ServiceEntity::getName).orElse("unknown");
        return toResponse(entity, sourceName);
    }

    /**
     * Build a full dependency graph for a service.
     * <p>
     * The graph includes three layers so the user sees the full neighbourhood:
     * <ol>
     *   <li><b>Outbound:</b> this service → its direct targets (services, databases, caches, cloud)</li>
     *   <li><b>Inbound:</b>  other services → this service</li>
     *   <li><b>Neighbour expansion:</b> outbound dependencies of every neighbouring SERVICE node
     *       discovered in steps 1–2. This ensures that downstream infrastructure (e.g. Redis, PostgreSQL)
     *       reachable through a peer service is visible when viewing the root service.</li>
     * </ol>
     */
    @Transactional(readOnly = true)
    public DependencyGraphResponse getDependencyGraph(UUID serviceId) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        Map<String, DependencyNode> nodeMap = new LinkedHashMap<>();
        List<DependencyEdge> edges = new ArrayList<>();
        // Track edge IDs to avoid duplicates from inbound/outbound overlap
        Set<String> edgeIds = new HashSet<>();

        // Centre node
        nodeMap.put(service.getName(), DependencyNode.builder()
                .id(service.getName())
                .label(service.getName())
                .nodeType("SERVICE")
                .serviceId(service.getId().toString())
                .build());

        // ── Outbound: this service → its targets ────────────────────────────
        addOutboundEdges(serviceId, service.getName(), nodeMap, edges, edgeIds);

        // ── Inbound: other services → this service ──────────────────────────
        List<DependencyEntity> inbound = dependencyRepository.findByTargetServiceName(service.getName());
        for (DependencyEntity dep : inbound) {
            if (edgeIds.contains(dep.getId().toString())) continue;
            String sourceName = serviceRepository.findById(dep.getSourceServiceId())
                    .map(ServiceEntity::getName)
                    .orElse(null);
            if (sourceName == null || sourceName.equals(service.getName())) continue;

            if (!nodeMap.containsKey(sourceName)) {
                nodeMap.put(sourceName, DependencyNode.builder()
                        .id(sourceName)
                        .label(sourceName)
                        .nodeType("SERVICE")
                        .serviceId(dep.getSourceServiceId().toString())
                        .build());
            }

            edgeIds.add(dep.getId().toString());
            edges.add(DependencyEdge.builder()
                    .id(dep.getId().toString())
                    .source(sourceName)
                    .target(service.getName())
                    .dependencyType(dep.getDependencyType())
                    .callCount1h(dep.getCallCount1h())
                    .errorCount1h(dep.getErrorCount1h())
                    .avgLatencyMs1h(dep.getAvgLatencyMs1h())
                    .build());
        }

        // ── Neighbour expansion: outbound deps of neighbouring SERVICE nodes ─
        // Collect the SERVICE neighbours discovered so far (excluding the root)
        List<DependencyNode> neighbourServices = nodeMap.values().stream()
                .filter(n -> "SERVICE".equals(n.getNodeType()) && n.getServiceId() != null
                        && !n.getServiceId().equals(service.getId().toString()))
                .toList();

        for (DependencyNode neighbour : neighbourServices) {
            UUID neighbourId = UUID.fromString(neighbour.getServiceId());
            addOutboundEdges(neighbourId, neighbour.getId(), nodeMap, edges, edgeIds);
        }

        return DependencyGraphResponse.builder()
                .nodes(new ArrayList<>(nodeMap.values()))
                .edges(edges)
                .build();
    }

    /**
     * Add all outbound dependency edges for a given source service to the graph.
     */
    private void addOutboundEdges(UUID sourceServiceId, String sourceName,
                                   Map<String, DependencyNode> nodeMap,
                                   List<DependencyEdge> edges,
                                   Set<String> edgeIds) {
        List<DependencyEntity> outbound = dependencyRepository.findBySourceServiceIdAndActiveTrue(sourceServiceId);
        for (DependencyEntity dep : outbound) {
            if (edgeIds.contains(dep.getId().toString())) continue;

            String targetId = dep.getTargetServiceName();
            if (!nodeMap.containsKey(targetId)) {
                String targetServiceId = serviceRepository.findByName(targetId)
                        .map(s -> s.getId().toString())
                        .orElse(null);

                nodeMap.put(targetId, DependencyNode.builder()
                        .id(targetId)
                        .label(dep.getDisplayName() != null ? dep.getDisplayName() : targetId)
                        .nodeType(dep.getTargetType())
                        .serviceId(targetServiceId)
                        .build());
            }

            edgeIds.add(dep.getId().toString());
            edges.add(DependencyEdge.builder()
                    .id(dep.getId().toString())
                    .source(sourceName)
                    .target(targetId)
                    .dependencyType(dep.getDependencyType())
                    .callCount1h(dep.getCallCount1h())
                    .errorCount1h(dep.getErrorCount1h())
                    .avgLatencyMs1h(dep.getAvgLatencyMs1h())
                    .build());
        }
    }

    // ── Extraction from trace ──────────────────────────────────────────────────

    /**
     * Extract dependencies from a Jaeger trace and upsert them into the database.
     *
     * @param traceId the Jaeger trace ID
     * @return number of dependencies extracted/updated
     */
    @Transactional
    public int extractFromTrace(String traceId) {
        JaegerResponse response = jaegerClient.getTrace(traceId);
        if (response.getData() == null || response.getData().isEmpty()) {
            log.warn("No trace data found for traceId={}", traceId);
            return 0;
        }

        int count = extractDependenciesFromJaegerTrace(response.getData().get(0));
        log.info("Extracted {} dependencies from trace {}", count, traceId);
        return count;
    }

    /**
     * Batch extraction — fetch recent traces for a service and extract dependencies.
     */
    @Transactional
    public int extractFromRecentTraces(UUID serviceId, int traceLimit) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        Instant end = Instant.now();
        Instant start = end.minusSeconds(3600); // last hour

        JaegerResponse response = jaegerClient.getTraces(
                service.getName(), null, start, end, null, null, traceLimit, null);

        if (response.getData() == null || response.getData().isEmpty()) {
            log.info("No recent traces found for service '{}'", service.getName());
            return 0;
        }

        int totalCount = 0;
        for (JaegerTrace trace : response.getData()) {
            totalCount += extractDependenciesFromJaegerTrace(trace);
        }

        log.info("Extracted {} dependencies from {} traces for service '{}'",
                totalCount, response.getData().size(), service.getName());
        return totalCount;
    }

    // ── Internal helpers ───────────────────────────────────────────────────────

    /**
     * Extract dependencies from a full Jaeger trace using two strategies:
     *
     * <p><b>Strategy 1 — Trace topology:</b> Analyse parent→child span relationships.
     * If parent span belongs to service A and child span belongs to service B (A ≠ B),
     * then A depends on B. This is the most reliable method and works regardless of
     * whether OTel semantic attributes like {@code peer.service} are present.</p>
     *
     * <p><b>Strategy 2 — Span attributes:</b> Inspect tags on CLIENT spans for
     * {@code peer.service}, {@code db.system}, {@code rpc.system}, {@code net.peer.name}
     * to enrich dependency metadata (type, db system, display name).</p>
     */
    private int extractDependenciesFromJaegerTrace(JaegerTrace trace) {
        Map<String, JaegerProcess> processes = trace.getProcesses();
        if (processes == null) processes = Map.of();
        List<JaegerSpan> spans = trace.getSpans();
        if (spans == null || spans.isEmpty()) return 0;

        // Build spanId → span lookup and spanId → serviceName lookup
        Map<String, JaegerSpan> spanMap = new HashMap<>();
        Map<String, String> spanServiceMap = new HashMap<>();
        for (JaegerSpan span : spans) {
            spanMap.put(span.getSpanId(), span);
            String svcName = resolveServiceName(span.getProcessId(), processes);
            if (svcName != null) spanServiceMap.put(span.getSpanId(), svcName);
        }

        // Track which (source→target) pairs we've already recorded in this trace
        Set<String> seen = new HashSet<>();
        int count = 0;

        // ── Strategy 1: Trace topology (parent-child across services) ───────
        for (JaegerSpan span : spans) {
            if (span.getReferences() == null) continue;
            String childService = spanServiceMap.get(span.getSpanId());
            if (childService == null) continue;

            for (JaegerReference ref : span.getReferences()) {
                if (!"CHILD_OF".equals(ref.getRefType())) continue;
                String parentService = spanServiceMap.get(ref.getSpanId());
                if (parentService == null || parentService.equals(childService)) continue;

                // parentService → childService dependency (cross-service call)
                String pairKey = parentService + "→" + childService;
                if (!seen.add(pairKey)) continue; // already recorded

                Optional<ServiceEntity> parentEntity = serviceRepository.findByName(parentService);
                if (parentEntity.isEmpty()) continue;

                UUID sourceId = parentEntity.get().getId();
                JaegerSpan parentSpan = spanMap.get(ref.getSpanId());
                Map<String, String> parentTags = parentSpan != null ? extractTags(parentSpan) : Map.of();
                boolean hasError = "true".equalsIgnoreCase(parentTags.get(TAG_ERROR));
                long durationMs = parentSpan != null ? parentSpan.getDuration() / 1000 : 0;

                // Cross-service topology always means the target is a SERVICE.
                // Only use parent span tags to determine the communication protocol.
                String depType = "HTTP";
                if ("grpc".equalsIgnoreCase(parentTags.get(TAG_RPC_SYSTEM))) {
                    depType = "GRPC";
                }

                upsertDependency(sourceId, childService, depType, "SERVICE", null, childService, hasError, durationMs);
                count++;
            }
        }

        // ── Strategy 2: Span attribute enrichment (CLIENT spans with tags) ──
        for (JaegerSpan span : spans) {
            count += extractDependenciesFromSpanTags(span, processes, seen);
        }

        return count;
    }

    /**
     * Tag-based extraction for CLIENT spans. Used as fallback/enrichment after
     * topology analysis. Skips pairs already found by topology strategy.
     */
    private int extractDependenciesFromSpanTags(JaegerSpan span,
                                                 Map<String, JaegerProcess> processes,
                                                 Set<String> seen) {
        Map<String, String> tags = extractTags(span);

        // Only process CLIENT spans for tag-based extraction
        String spanKind = tags.get(TAG_SPAN_KIND);
        if (!"client".equalsIgnoreCase(spanKind)) {
            return 0;
        }

        String sourceServiceName = resolveServiceName(span.getProcessId(), processes);
        if (sourceServiceName == null || sourceServiceName.isBlank()) return 0;

        Optional<ServiceEntity> sourceServiceOpt = serviceRepository.findByName(sourceServiceName);
        if (sourceServiceOpt.isEmpty()) return 0;
        UUID sourceServiceId = sourceServiceOpt.get().getId();

        boolean hasError = "true".equalsIgnoreCase(tags.get(TAG_ERROR));
        long durationMs = span.getDuration() / 1000;
        int count = 0;

        // 1. Database or Cache dependency
        String dbSystem = tags.get(TAG_DB_SYSTEM);
        if (dbSystem != null && !dbSystem.isBlank()) {
            String dbName = tags.get(TAG_DB_NAME);
            String targetName = dbName != null ? dbSystem + ":" + dbName : dbSystem;
            if (seen.add(sourceServiceName + "→" + targetName)) {
                String displayName = dbName != null ? dbName + " (" + dbSystem + ")" : dbSystem;
                boolean isCache = isCacheSystem(dbSystem);
                String depType = isCache ? "CACHE" : "DATABASE";
                String targetType = isCache ? "CACHE" : "DATABASE";
                upsertDependency(sourceServiceId, targetName, depType, targetType, dbSystem, displayName, hasError, durationMs);
                count++;
            }
        }

        // 2. gRPC dependency
        String rpcSystem = tags.get(TAG_RPC_SYSTEM);
        if ("grpc".equalsIgnoreCase(rpcSystem)) {
            String rpcService = tags.get(TAG_RPC_SERVICE);
            String peerService = tags.get(TAG_PEER_SERVICE);
            String targetName = rpcService != null ? rpcService : peerService;
            if (targetName != null && !targetName.isBlank() && seen.add(sourceServiceName + "→" + targetName)) {
                upsertDependency(sourceServiceId, targetName, "GRPC", "SERVICE", null, targetName, hasError, durationMs);
                count++;
            }
        }

        // 3. HTTP / peer.service / net.peer.name
        if (count == 0) {
            String peerService = tags.get(TAG_PEER_SERVICE);
            if (peerService != null && !peerService.isBlank() && seen.add(sourceServiceName + "→" + peerService)) {
                upsertDependency(sourceServiceId, peerService, "HTTP", "SERVICE", null, peerService, hasError, durationMs);
                count++;
            } else if (peerService == null) {
                String netPeer = tags.get(TAG_NET_PEER_NAME);
                if (netPeer != null && !netPeer.isBlank() && seen.add(sourceServiceName + "→" + netPeer)) {
                    String targetType = inferTargetType(netPeer);
                    String depType = "CLOUD_COMPONENT".equals(targetType) ? "CLOUD" : "HTTP";
                    upsertDependency(sourceServiceId, netPeer, depType, targetType, null, netPeer, hasError, durationMs);
                    count++;
                }
            }
        }

        return count;
    }

    /**
     * Upsert a dependency — update if already exists (by unique constraint), create otherwise.
     */
    private void upsertDependency(UUID sourceServiceId, String targetServiceName,
                                   String dependencyType, String targetType,
                                   String dbSystem, String displayName,
                                   boolean hasError, long durationMs) {
        Optional<DependencyEntity> existingOpt = dependencyRepository
                .findBySourceServiceIdAndTargetServiceNameAndDependencyType(
                        sourceServiceId, targetServiceName, dependencyType);

        if (existingOpt.isPresent()) {
            DependencyEntity existing = existingOpt.get();
            existing.setLastSeenAt(Instant.now());
            existing.setCallCount1h(existing.getCallCount1h() + 1);
            if (hasError) {
                existing.setErrorCount1h(existing.getErrorCount1h() + 1);
            }
            // Running average
            long totalCalls = existing.getCallCount1h();
            existing.setAvgLatencyMs1h(
                    ((existing.getAvgLatencyMs1h() * (totalCalls - 1)) + durationMs) / totalCalls);
            existing.setActive(true);
            if (displayName != null) existing.setDisplayName(displayName);
            if (dbSystem != null) existing.setDbSystem(dbSystem);
            dependencyRepository.save(existing);
        } else {
            DependencyEntity entity = DependencyEntity.builder()
                    .sourceServiceId(sourceServiceId)
                    .targetServiceName(targetServiceName)
                    .dependencyType(dependencyType)
                    .targetType(targetType)
                    .dbSystem(dbSystem)
                    .displayName(displayName)
                    .lastSeenAt(Instant.now())
                    .callCount1h(1)
                    .errorCount1h(hasError ? 1 : 0)
                    .avgLatencyMs1h(durationMs)
                    .active(true)
                    .build();
            dependencyRepository.save(entity);
        }
    }

    /**
     * Extract span tags as a flat key→value map.
     */
    private Map<String, String> extractTags(JaegerSpan span) {
        if (span.getTags() == null) return Map.of();
        return span.getTags().stream()
                .filter(t -> t.getKey() != null && t.getValue() != null)
                .collect(Collectors.toMap(
                        JaegerTag::getKey,
                        t -> String.valueOf(t.getValue()),
                        (v1, v2) -> v2 // keep last in case of duplicate keys
                ));
    }

    /**
     * Resolve service name from the Jaeger process map.
     */
    private String resolveServiceName(String processId, Map<String, JaegerProcess> processes) {
        if (processId == null || processes == null) return null;
        JaegerProcess process = processes.get(processId);
        return process != null ? process.getServiceName() : null;
    }

    /**
     * Infer target type from a net.peer.name value.
     * Cloud-like hostnames (containing aws, azure, gcp, cloud) → CLOUD_COMPONENT, otherwise SERVICE.
     */
    private String inferTargetType(String hostname) {
        String lower = hostname.toLowerCase();
        if (lower.contains("amazonaws.com") || lower.contains("azure") ||
            lower.contains("googleapis.com") || lower.contains("cloud.google") ||
            lower.contains(".sqs.") || lower.contains(".s3.") || lower.contains(".dynamodb.")) {
            return "CLOUD_COMPONENT";
        }
        return "SERVICE";
    }

    /** Cache systems recognised during dependency extraction. */
    private static final Set<String> CACHE_DB_SYSTEMS = Set.of(
            "redis", "memcached", "valkey", "hazelcast", "aerospike");

    /** Returns true if the given db.system value represents a cache store. */
    private boolean isCacheSystem(String dbSystem) {
        return dbSystem != null && CACHE_DB_SYSTEMS.contains(dbSystem.toLowerCase());
    }

    private DependencyResponse toResponse(DependencyEntity entity, String sourceServiceName) {
        return DependencyResponse.builder()
                .id(entity.getId())
                .sourceServiceId(entity.getSourceServiceId())
                .sourceServiceName(sourceServiceName)
                .targetServiceName(entity.getTargetServiceName())
                .dependencyType(entity.getDependencyType())
                .dbSystem(entity.getDbSystem())
                .targetType(entity.getTargetType())
                .displayName(entity.getDisplayName())
                .lastSeenAt(entity.getLastSeenAt())
                .callCount1h(entity.getCallCount1h())
                .errorCount1h(entity.getErrorCount1h())
                .avgLatencyMs1h(entity.getAvgLatencyMs1h())
                .active(entity.isActive())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

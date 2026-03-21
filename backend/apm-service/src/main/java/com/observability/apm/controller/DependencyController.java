package com.observability.apm.controller;

import com.observability.apm.dto.DependencyGraphResponse;
import com.observability.apm.dto.DependencyMetricsResponse;
import com.observability.apm.dto.DependencyResponse;
import com.observability.apm.service.DependencyMetricsService;
import com.observability.apm.service.DependencyService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Story 11.3/11.4 — Dependency graph and metrics REST controller.
 * Provides endpoints for querying, extracting, and metering service dependencies.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Dependencies", description = "Service dependency graph — query, extract, and metrics")
public class DependencyController {

    private final DependencyService dependencyService;
    private final DependencyMetricsService dependencyMetricsService;

    @GetMapping("/api/v1/services/{serviceId}/dependencies")
    @Operation(summary = "List dependencies for a service")
    public ResponseEntity<ApiResponse<List<DependencyResponse>>> listDependencies(
            @PathVariable UUID serviceId) {
        List<DependencyResponse> result = dependencyService.getDependencies(serviceId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/services/{serviceId}/dependencies/graph")
    @Operation(summary = "Get dependency graph (nodes + edges) for a service")
    public ResponseEntity<ApiResponse<DependencyGraphResponse>> getDependencyGraph(
            @PathVariable UUID serviceId) {
        DependencyGraphResponse result = dependencyService.getDependencyGraph(serviceId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/dependencies/{dependencyId}")
    @Operation(summary = "Get a single dependency by ID")
    public ResponseEntity<ApiResponse<DependencyResponse>> getDependency(
            @PathVariable UUID dependencyId) {
        DependencyResponse result = dependencyService.getDependency(dependencyId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Story 11.4: Per-dependency metrics ────────────────────────────────────

    @GetMapping("/api/v1/dependencies/{dependencyId}/metrics")
    @Operation(summary = "Story 11.4: Get per-dependency latency, error rate, and throughput metrics")
    public ResponseEntity<ApiResponse<DependencyMetricsResponse>> getDependencyMetrics(
            @PathVariable UUID dependencyId,
            @RequestParam(defaultValue = "60") long stepSeconds,
            @RequestParam(defaultValue = "5m") String rateWindow,
            @RequestParam(required = false) Instant start,
            @RequestParam(required = false) Instant end) {
        if (end == null) end = Instant.now();
        if (start == null) start = end.minusSeconds(3600); // default: last 1 hour

        DependencyMetricsResponse result = dependencyMetricsService.getDependencyMetrics(
                dependencyId, start, end, stepSeconds, rateWindow);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/services/{serviceId}/dependencies/metrics")
    @Operation(summary = "Story 11.4: Get metrics for all dependencies of a service")
    public ResponseEntity<ApiResponse<List<DependencyMetricsResponse>>> getServiceDependencyMetrics(
            @PathVariable UUID serviceId,
            @RequestParam(defaultValue = "60") long stepSeconds,
            @RequestParam(defaultValue = "5m") String rateWindow,
            @RequestParam(required = false) Instant start,
            @RequestParam(required = false) Instant end) {
        if (end == null) end = Instant.now();
        if (start == null) start = end.minusSeconds(3600);

        List<DependencyMetricsResponse> result = dependencyMetricsService.getServiceDependencyMetrics(
                serviceId, start, end, stepSeconds, rateWindow);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Story 11.3: Extract from traces ────────────────────────────────────────

    @PostMapping("/api/v1/dependencies/extract-from-trace")
    @Operation(summary = "Extract dependencies from a Jaeger trace")
    public ResponseEntity<ApiResponse<Map<String, Object>>> extractFromTrace(
            @RequestParam String traceId) {
        int count = dependencyService.extractFromTrace(traceId);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "traceId", traceId,
                "dependenciesExtracted", count
        )));
    }

    @PostMapping("/api/v1/services/{serviceId}/dependencies/extract")
    @Operation(summary = "Extract dependencies from recent traces for a service")
    public ResponseEntity<ApiResponse<Map<String, Object>>> extractFromRecentTraces(
            @PathVariable UUID serviceId,
            @RequestParam(defaultValue = "20") int traceLimit) {
        int count = dependencyService.extractFromRecentTraces(serviceId, traceLimit);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "serviceId", serviceId.toString(),
                "traceLimit", traceLimit,
                "dependenciesExtracted", count
        )));
    }
}

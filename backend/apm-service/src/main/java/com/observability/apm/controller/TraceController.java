package com.observability.apm.controller;

import com.observability.apm.dto.TimeRangeRequest;
import com.observability.apm.dto.TimeRangeResolver;
import com.observability.apm.dto.TraceDetailResponse;
import com.observability.apm.dto.TraceSearchResponse;
import com.observability.apm.service.TraceService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Story 7.2 / 7.3 — Trace REST controller.
 * Provides service-level trace listing with filters, API-level trace filtering,
 * and trace detail retrieval.
 *
 * <p>Endpoints follow the HLD convention:
 * {@code GET /api/v1/services/{serviceId}/traces}            — list traces (with optional operation filter)
 * {@code GET /api/v1/services/{serviceId}/traces/operations} — list available operations/endpoints
 * {@code GET /api/v1/traces/{traceId}}                       — trace detail
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "Traces", description = "Distributed trace querying via Jaeger")
public class TraceController {

    private final TraceService traceService;

    // ── Service-level trace listing (with optional API-level operation filter) ─

    @GetMapping("/api/v1/services/{serviceId}/traces")
    @Operation(summary = "List traces for a service",
            description = "Returns trace summaries matching service, time range, and optional " +
                    "operation/duration/error filters. Use the 'operation' parameter to scope " +
                    "to a specific HTTP route or endpoint (Story 7.3).")
    public ResponseEntity<ApiResponse<TraceSearchResponse>> getServiceTraces(

            @PathVariable UUID serviceId,

            @Parameter(description = "Operation name / HTTP route to filter by (e.g. 'GET /api/v1/users'). " +
                    "Scopes results to traces originating at a specific endpoint.")
            @RequestParam(required = false) String operation,

            @Parameter(description = "Named time range preset (e.g. LAST_1H, LAST_24H). Overrides start/end.")
            @RequestParam(required = false) String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end,

            @Parameter(description = "Minimum trace duration (e.g. '100ms', '1s')")
            @RequestParam(required = false) String minDuration,

            @Parameter(description = "Maximum trace duration (e.g. '5s', '10s')")
            @RequestParam(required = false) String maxDuration,

            @Parameter(description = "Maximum number of traces to return (default 20, max 100)")
            @RequestParam(required = false, defaultValue = "20") int limit,

            @Parameter(description = "Tag filter in JSON format (e.g. {\"error\":\"true\"})")
            @RequestParam(required = false) String tags) {

        if (limit > 100) limit = 100;
        if (limit < 1) limit = 20;

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, 0, null);

        TraceSearchResponse result = traceService.searchTraces(
                serviceId, operation, tr.getStart(), tr.getEnd(),
                minDuration, maxDuration, limit, tags);

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Story 7.3: List operations (endpoints) for a service ──────────────────

    @GetMapping("/api/v1/services/{serviceId}/traces/operations")
    @Operation(summary = "List trace operations for a service",
            description = "Returns all operation names (HTTP routes / RPC methods) known to " +
                    "Jaeger for the given service. Use these values in the 'operation' filter " +
                    "of the trace search endpoint.")
    public ResponseEntity<ApiResponse<List<String>>> getServiceOperations(
            @PathVariable UUID serviceId) {

        List<String> operations = traceService.getOperations(serviceId);
        return ResponseEntity.ok(ApiResponse.success(operations));
    }

    // ── Trace detail ──────────────────────────────────────────────────────────

    @GetMapping("/api/v1/traces/{traceId}")
    @Operation(summary = "Get trace detail",
            description = "Returns full trace with all spans for the waterfall view")
    public ResponseEntity<ApiResponse<TraceDetailResponse>> getTraceDetail(

            @Parameter(description = "The distributed trace ID")
            @PathVariable String traceId) {

        TraceDetailResponse detail = traceService.getTraceDetail(traceId);
        return ResponseEntity.ok(ApiResponse.success(detail));
    }
}

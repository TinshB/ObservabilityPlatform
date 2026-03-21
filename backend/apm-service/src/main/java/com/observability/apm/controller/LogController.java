package com.observability.apm.controller;

import com.observability.apm.dto.LogSearchResponse;
import com.observability.apm.dto.TimeRangeRequest;
import com.observability.apm.dto.TimeRangeResolver;
import com.observability.apm.service.LogSearchService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Story 6.4 / 6.8 / 7.1 — Log search REST controller.
 * Provides full-text search, filtered browsing, and trace-correlated log retrieval.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/logs")
@RequiredArgsConstructor
@Tag(name = "Logs", description = "Log search and exploration from Elasticsearch")
public class LogController {

    private final LogSearchService logSearchService;

    @GetMapping
    @Operation(summary = "Search log entries",
            description = "Paginated log search with service, severity, time range, trace ID, and full-text filters")
    public ResponseEntity<ApiResponse<LogSearchResponse>> searchLogs(

            @Parameter(description = "Service ID to filter by (optional — omit for all services)")
            @RequestParam(required = false) UUID serviceId,

            @Parameter(description = "Severity levels to include (e.g. ERROR,WARN). Omit for all.")
            @RequestParam(required = false) List<String> severity,

            @Parameter(description = "Full-text search query on log message body")
            @RequestParam(required = false, name = "q") String searchText,

            @Parameter(description = "Trace ID to filter by — retrieve all logs belonging to a distributed trace")
            @RequestParam(required = false) String traceId,

            @Parameter(description = "Named time range preset (e.g. LAST_1H, LAST_24H). Overrides start/end.")
            @RequestParam(required = false) String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end,

            @Parameter(description = "Zero-based page number (default 0)")
            @RequestParam(required = false, defaultValue = "0") int page,

            @Parameter(description = "Page size (default 50, max 200)")
            @RequestParam(required = false, defaultValue = "50") int size) {

        // Clamp page size
        if (size > 200) size = 200;
        if (size < 1) size = 50;

        // Resolve time range (reuse existing preset/absolute resolution)
        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, 0, null);

        LogSearchResponse result = logSearchService.searchLogs(
                serviceId, severity, searchText, traceId, tr.getStart(), tr.getEnd(), page, size);

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Story 7.1: Trace-level log correlation ────────────────────────────────

    @GetMapping("/trace/{traceId}")
    @Operation(summary = "Get logs by trace ID",
            description = "Retrieve all log entries correlated with a distributed trace. " +
                    "Uses a 30-day lookback window. Results sorted by timestamp ascending (span order).")
    public ResponseEntity<ApiResponse<LogSearchResponse>> getLogsByTraceId(

            @Parameter(description = "The distributed trace ID")
            @PathVariable String traceId,

            @Parameter(description = "Page number (default 0)")
            @RequestParam(required = false, defaultValue = "0") int page,

            @Parameter(description = "Page size (default 100, max 200)")
            @RequestParam(required = false, defaultValue = "100") int size) {

        if (size > 200) size = 200;
        if (size < 1) size = 100;

        // Use a wide time window (30 days) since the caller may not know the exact span
        TimeRangeRequest tr = TimeRangeResolver.resolve("LAST_30D", null, null, 0, null);

        LogSearchResponse result = logSearchService.searchLogs(
                null, null, null, traceId, tr.getStart(), tr.getEnd(), page, size);

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

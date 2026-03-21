package com.observability.apm.controller;

import com.observability.apm.dto.SpanBreakupResponse;
import com.observability.apm.service.SpanBreakupService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Story 8.1 — Span-level breakup controller.
 * Decomposes a trace into individual span durations, operations, and statuses.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "Span Breakup", description = "Per-operation span decomposition of a distributed trace")
public class SpanBreakupController {

    private final SpanBreakupService spanBreakupService;

    @GetMapping("/api/v1/traces/{traceId}/span-breakup")
    @Operation(summary = "Get span-level breakup for a trace",
            description = "Decomposes a distributed trace into per-operation summaries with " +
                    "total duration, self-time, span count, error count, and percentage of trace. " +
                    "Results are ordered by total duration descending.")
    public ResponseEntity<ApiResponse<SpanBreakupResponse>> getSpanBreakup(

            @Parameter(description = "The distributed trace ID")
            @PathVariable String traceId) {

        SpanBreakupResponse result = spanBreakupService.getSpanBreakup(traceId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

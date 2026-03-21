package com.observability.apm.controller;

import com.observability.apm.dto.LogEnrichmentValidationResponse;
import com.observability.apm.dto.TimeRangeRequest;
import com.observability.apm.dto.TimeRangeResolver;
import com.observability.apm.service.LogEnrichmentService;
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
import java.util.UUID;

/**
 * Story 7.4 — Log enrichment validation controller.
 * Verifies that log records have proper trace context (traceId, spanId, service.name)
 * injected by the OTel pipeline.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "Log Enrichment", description = "Validate OTel log enrichment quality")
public class LogEnrichmentController {

    private final LogEnrichmentService logEnrichmentService;

    @GetMapping("/api/v1/services/{serviceId}/logs/enrichment-validation")
    @Operation(summary = "Validate log enrichment for a service",
            description = "Checks coverage of traceId, spanId, and service.name fields in log records. " +
                    "Returns per-field coverage rates, an overall health score, and sample logs " +
                    "missing enrichment fields.")
    public ResponseEntity<ApiResponse<LogEnrichmentValidationResponse>> validateEnrichment(

            @PathVariable UUID serviceId,

            @Parameter(description = "Named time range preset (e.g. LAST_1H, LAST_24H). Overrides start/end.")
            @RequestParam(required = false, defaultValue = "LAST_1H") String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, 0, null);

        LogEnrichmentValidationResponse result = logEnrichmentService.validate(
                serviceId, tr.getStart(), tr.getEnd());

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

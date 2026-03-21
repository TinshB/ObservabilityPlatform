package com.observability.apm.controller;

import com.observability.apm.dto.CorrelationResponse;
import com.observability.apm.service.CorrelationService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Story 9.1 — Cross-signal correlation endpoint.
 * Returns trace detail, metrics snapshot, and correlated logs for a given trace ID.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Correlation", description = "Cross-signal correlation for unified observability")
public class CorrelationController {

    private final CorrelationService correlationService;

    @GetMapping("/api/v1/traces/{traceId}/correlation")
    @Operation(summary = "Get cross-signal correlation for a trace",
            description = "Returns the trace detail, a metrics snapshot for the root service, " +
                    "and all logs correlated with the given trace ID.")
    public ResponseEntity<ApiResponse<CorrelationResponse>> getTraceCorrelation(
            @Parameter(description = "The distributed trace ID")
            @PathVariable String traceId) {

        CorrelationResponse result = correlationService.getCorrelation(traceId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

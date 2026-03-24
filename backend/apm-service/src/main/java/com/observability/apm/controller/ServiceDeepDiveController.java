package com.observability.apm.controller;

import com.observability.apm.dto.ServiceDeepDiveResponse;
import com.observability.apm.dto.TimeRangeRequest;
import com.observability.apm.dto.TimeRangeResolver;
import com.observability.apm.service.ServiceDeepDiveService;
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
 * Story 8.2 — Service Deep Dive controller.
 * Aggregates health score, key metrics, recent errors, log volume,
 * and trace summary for a single service.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "Service Deep Dive", description = "Unified health overview for a service")
public class ServiceDeepDiveController {

    private final ServiceDeepDiveService serviceDeepDiveService;

    @GetMapping("/api/v1/services/{serviceId}/deep-dive")
    @Operation(summary = "Get service deep dive by ID",
            description = "Returns an aggregated health overview for a service including " +
                    "current key metrics (latency, error rate, RPS), recent error traces, " +
                    "log volume summary, trace activity, and a composite health score.")
    public ResponseEntity<ApiResponse<ServiceDeepDiveResponse>> getDeepDive(

            @PathVariable UUID serviceId,

            @Parameter(description = "Named time range preset (e.g. LAST_1H, LAST_24H). Overrides start/end.")
            @RequestParam(required = false, defaultValue = "LAST_1H") String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, 0, null);

        ServiceDeepDiveResponse result = serviceDeepDiveService.getDeepDive(
                serviceId, tr.getStart(), tr.getEnd(), tr.getRateWindow());

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/services/by-name/{serviceName}/deep-dive")
    @Operation(summary = "Get service deep dive by name",
            description = "Same as the ID-based endpoint but looks up the service by name.")
    public ResponseEntity<ApiResponse<ServiceDeepDiveResponse>> getDeepDiveByName(

            @PathVariable String serviceName,

            @Parameter(description = "Named time range preset (e.g. LAST_1H, LAST_24H). Overrides start/end.")
            @RequestParam(required = false, defaultValue = "LAST_1H") String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, 0, null);

        ServiceDeepDiveResponse result = serviceDeepDiveService.getDeepDiveByName(
                serviceName, tr.getStart(), tr.getEnd(), tr.getRateWindow());

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

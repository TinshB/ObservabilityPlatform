package com.observability.apm.controller;

import com.observability.apm.dto.ApmOverviewResponse;
import com.observability.apm.dto.TimeRangeRequest;
import com.observability.apm.dto.TimeRangeResolver;
import com.observability.apm.service.ApmOverviewService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * Story 8.3 — APM Overview controller.
 * Provides a platform-wide service health summary, top unhealthy services,
 * and signal volume statistics.
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@Tag(name = "APM Overview", description = "Platform-wide APM health dashboard data")
public class ApmOverviewController {

    private final ApmOverviewService apmOverviewService;

    @GetMapping("/api/v1/apm/overview")
    @Operation(summary = "Get APM overview",
            description = "Returns a platform-wide health summary including per-service health scores, " +
                    "top unhealthy services, health distribution, and signal enablement counts. " +
                    "The time range controls the rate window used for Prometheus metric queries.")
    public ResponseEntity<ApiResponse<ApmOverviewResponse>> getOverview(

            @Parameter(description = "Named time range preset (e.g. LAST_1H, LAST_24H). " +
                    "Controls the rate window used for metric calculations.")
            @RequestParam(required = false, defaultValue = "LAST_1H") String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, 0, null);

        ApmOverviewResponse result = apmOverviewService.getOverview(tr.getRateWindow());
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

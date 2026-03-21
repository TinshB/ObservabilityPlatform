package com.observability.apm.controller;

import com.observability.apm.dto.ApiMetricsResponse;
import com.observability.apm.dto.InfraMetricsResponse;
import com.observability.apm.dto.LogMetricsResponse;
import com.observability.apm.dto.QueryMetricsResponse;
import com.observability.apm.dto.ServiceMetricsResponse;
import com.observability.apm.dto.TimeRangePresetResponse;
import com.observability.apm.dto.TimeRangeRequest;
import com.observability.apm.dto.TimeRangeResolver;
import com.observability.apm.dto.UiMetricsResponse;
import com.observability.apm.service.LogMetricsService;
import com.observability.apm.service.MetricsService;
import com.observability.apm.service.QueryMetricsService;
import com.observability.apm.service.UiMetricsService;
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

@Slf4j
@RestController
@RequestMapping("/api/v1/services/{serviceId}/metrics")
@RequiredArgsConstructor
@Tag(name = "Metrics", description = "Service and API-level metrics queried from Prometheus")
public class MetricsController {

    private final MetricsService metricsService;
    private final UiMetricsService uiMetricsService;
    private final QueryMetricsService queryMetricsService;
    private final LogMetricsService logMetricsService;

    // ── Story 5.1: Service-Level Metrics ────────────────────────────────────────

    @GetMapping
    @Operation(summary = "Get service-level metrics",
            description = "Returns latency (P50/P95/P99), error rate, and RPS time-series for a service")
    public ResponseEntity<ApiResponse<ServiceMetricsResponse>> getServiceMetrics(
            @PathVariable UUID serviceId,

            @Parameter(description = "Named preset (e.g. LAST_1H, LAST_24H). Overrides start/end/step/rateWindow.")
            @RequestParam(required = false) String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end,

            @Parameter(description = "Resolution step in seconds (default: auto-calculated)")
            @RequestParam(required = false, defaultValue = "0") long step,

            @Parameter(description = "PromQL rate() window (default: auto-calculated)")
            @RequestParam(required = false) String rateWindow) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, step, rateWindow);

        ServiceMetricsResponse metrics = metricsService.getServiceMetrics(
                serviceId, tr.getStart(), tr.getEnd(), tr.getStepSeconds(), tr.getRateWindow());

        return ResponseEntity.ok(ApiResponse.success(metrics));
    }

    // ── Story 5.2: API-Level Metrics ────────────────────────────────────────────

    @GetMapping("/api")
    @Operation(summary = "Get API-level metrics",
            description = "Returns per-route latency histograms (P50/P95/P99), throughput, and status code distribution")
    public ResponseEntity<ApiResponse<ApiMetricsResponse>> getApiMetrics(
            @PathVariable UUID serviceId,

            @Parameter(description = "Named preset (e.g. LAST_1H, LAST_24H). Overrides start/end/step/rateWindow.")
            @RequestParam(required = false) String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end,

            @Parameter(description = "Resolution step in seconds (default: auto-calculated)")
            @RequestParam(required = false, defaultValue = "0") long step,

            @Parameter(description = "PromQL rate() window (default: auto-calculated)")
            @RequestParam(required = false) String rateWindow) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, step, rateWindow);

        ApiMetricsResponse metrics = metricsService.getApiMetrics(
                serviceId, tr.getStart(), tr.getEnd(), tr.getStepSeconds(), tr.getRateWindow());

        return ResponseEntity.ok(ApiResponse.success(metrics));
    }

    // ── Story 5.3: Infra-Level Metrics ──────────────────────────────────────────

    @GetMapping("/infra")
    @Operation(summary = "Get infra-level metrics",
            description = "Returns CPU, JVM memory, threads, classes, and GC metrics from OTel/Micrometer instrumentation")
    public ResponseEntity<ApiResponse<InfraMetricsResponse>> getInfraMetrics(
            @PathVariable UUID serviceId,

            @Parameter(description = "Named preset (e.g. LAST_1H, LAST_24H). Overrides start/end/step/rateWindow.")
            @RequestParam(required = false) String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end,

            @Parameter(description = "Resolution step in seconds (default: auto-calculated)")
            @RequestParam(required = false, defaultValue = "0") long step,

            @Parameter(description = "PromQL rate() window (default: auto-calculated)")
            @RequestParam(required = false) String rateWindow) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, step, rateWindow);

        InfraMetricsResponse metrics = metricsService.getInfraMetrics(
                serviceId, tr.getStart(), tr.getEnd(), tr.getStepSeconds(), tr.getRateWindow());

        return ResponseEntity.ok(ApiResponse.success(metrics));
    }

    // ── Story 6.1: UI-Level (Web Vitals) Metrics ─────────────────────────────

    @GetMapping("/ui")
    @Operation(summary = "Get UI-level (Web Vitals) metrics",
            description = "Returns FCP, LCP, CLS, and TTI percentile time-series with CWV threshold status")
    public ResponseEntity<ApiResponse<UiMetricsResponse>> getUiMetrics(
            @PathVariable UUID serviceId,

            @Parameter(description = "Named preset (e.g. LAST_1H, LAST_24H). Overrides start/end/step/rateWindow.")
            @RequestParam(required = false) String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end,

            @Parameter(description = "Resolution step in seconds (default: auto-calculated)")
            @RequestParam(required = false, defaultValue = "0") long step,

            @Parameter(description = "PromQL rate() window (default: auto-calculated)")
            @RequestParam(required = false) String rateWindow) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, step, rateWindow);

        UiMetricsResponse metrics = uiMetricsService.getUiMetrics(
                serviceId, tr.getStart(), tr.getEnd(), tr.getStepSeconds(), tr.getRateWindow());

        return ResponseEntity.ok(ApiResponse.success(metrics));
    }

    // ── Story 6.2: Query-Level Metrics ───────────────────────────────────────

    @GetMapping("/query")
    @Operation(summary = "Get query-level metrics",
            description = "Returns SQL execution time, call counts, and slow-query flags from OTel JDBC instrumentation")
    public ResponseEntity<ApiResponse<QueryMetricsResponse>> getQueryMetrics(
            @PathVariable UUID serviceId,

            @Parameter(description = "Named preset (e.g. LAST_1H, LAST_24H). Overrides start/end/step/rateWindow.")
            @RequestParam(required = false) String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end,

            @Parameter(description = "Resolution step in seconds (default: auto-calculated)")
            @RequestParam(required = false, defaultValue = "0") long step,

            @Parameter(description = "PromQL rate() window (default: auto-calculated)")
            @RequestParam(required = false) String rateWindow) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, step, rateWindow);

        QueryMetricsResponse metrics = queryMetricsService.getQueryMetrics(
                serviceId, tr.getStart(), tr.getEnd(), tr.getStepSeconds(), tr.getRateWindow());

        return ResponseEntity.ok(ApiResponse.success(metrics));
    }

    // ── Story 6.3: Log-Level Metrics ─────────────────────────────────────────

    @GetMapping("/logs")
    @Operation(summary = "Get log-level metrics",
            description = "Returns log volume per severity, error ratio, and top log patterns")
    public ResponseEntity<ApiResponse<LogMetricsResponse>> getLogMetrics(
            @PathVariable UUID serviceId,

            @Parameter(description = "Named preset (e.g. LAST_1H, LAST_24H). Overrides start/end/step/rateWindow.")
            @RequestParam(required = false) String range,

            @Parameter(description = "Range start (ISO-8601). Defaults to 1 hour ago.")
            @RequestParam(required = false) Instant start,

            @Parameter(description = "Range end (ISO-8601). Defaults to now.")
            @RequestParam(required = false) Instant end,

            @Parameter(description = "Resolution step in seconds (default: auto-calculated)")
            @RequestParam(required = false, defaultValue = "0") long step,

            @Parameter(description = "PromQL rate() window (default: auto-calculated)")
            @RequestParam(required = false) String rateWindow) {

        TimeRangeRequest tr = TimeRangeResolver.resolve(range, start, end, step, rateWindow);

        LogMetricsResponse metrics = logMetricsService.getLogMetrics(
                serviceId, tr.getStart(), tr.getEnd(), tr.getStepSeconds(), tr.getRateWindow());

        return ResponseEntity.ok(ApiResponse.success(metrics));
    }
}

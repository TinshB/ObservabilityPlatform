package com.observability.apm.controller;

import com.observability.apm.dto.LiveCorrelationResponse;
import com.observability.apm.dto.WorkflowInstanceResponse;
import com.observability.apm.dto.WorkflowInstanceStatsResponse;
import com.observability.apm.dto.WorkflowStepMetricsResponse;
import com.observability.apm.service.WorkflowCorrelationService;
import com.observability.apm.service.WorkflowInstanceService;
import com.observability.apm.service.WorkflowStepMetricsService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 12.4 — Workflow Instance REST controller.
 * Provides read APIs for workflow executions: list, detail with per-step breakdown, and stats.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Workflow Instances", description = "Query workflow executions — status, duration, per-step breakdown")
public class WorkflowInstanceController {

    private final WorkflowInstanceService workflowInstanceService;
    private final WorkflowCorrelationService workflowCorrelationService;
    private final WorkflowStepMetricsService workflowStepMetricsService;

    @GetMapping("/api/v1/workflows/{workflowId}/instances")
    @Operation(summary = "List workflow instances with optional filters")
    public ResponseEntity<ApiResponse<Page<WorkflowInstanceResponse>>> listInstances(
            @PathVariable UUID workflowId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<WorkflowInstanceResponse> result = workflowInstanceService.listInstances(
                workflowId, status, from, to, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/workflows/{workflowId}/instances/stats")
    @Operation(summary = "Get aggregate stats for workflow instances")
    public ResponseEntity<ApiResponse<WorkflowInstanceStatsResponse>> getStats(
            @PathVariable UUID workflowId) {
        WorkflowInstanceStatsResponse result = workflowInstanceService.getStats(workflowId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/workflows/{workflowId}/instances/{instanceId}")
    @Operation(summary = "Get workflow instance detail with per-step breakdown")
    public ResponseEntity<ApiResponse<WorkflowInstanceResponse>> getInstance(
            @PathVariable UUID workflowId,
            @PathVariable UUID instanceId) {
        WorkflowInstanceResponse result = workflowInstanceService.getInstance(workflowId, instanceId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/workflows/{workflowId}/steps/metrics")
    @Operation(summary = "Get live per-step metrics from Prometheus and Jaeger")
    public ResponseEntity<ApiResponse<WorkflowStepMetricsResponse>> getStepMetrics(
            @PathVariable UUID workflowId,
            @RequestParam(defaultValue = "5m") String rateWindow) {
        WorkflowStepMetricsResponse result = workflowStepMetricsService.getStepMetrics(workflowId, rateWindow);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/workflows/{workflowId}/correlate/live")
    @Operation(summary = "Live correlation — fetch traces from Jaeger, match to steps, return without persistence")
    public ResponseEntity<ApiResponse<LiveCorrelationResponse>> correlateLive(
            @PathVariable UUID workflowId,
            @RequestParam(defaultValue = "60") int lookbackMinutes,
            @RequestParam(defaultValue = "50") int traceLimit) {
        LiveCorrelationResponse result = workflowCorrelationService.correlateLive(
                workflowId, lookbackMinutes, traceLimit);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

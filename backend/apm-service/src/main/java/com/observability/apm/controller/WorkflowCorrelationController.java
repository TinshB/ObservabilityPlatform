package com.observability.apm.controller;

import com.observability.apm.dto.WorkflowCorrelationRequest;
import com.observability.apm.dto.WorkflowCorrelationResponse;
import com.observability.apm.service.WorkflowCorrelationService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Story 12.3 — Workflow correlation REST controller.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Workflow Correlation", description = "Correlate Jaeger traces against defined business workflows")
public class WorkflowCorrelationController {

    private final WorkflowCorrelationService correlationService;

    @PostMapping("/api/v1/workflows/correlate")
    @Operation(summary = "Run trace-to-workflow correlation")
    public ResponseEntity<ApiResponse<WorkflowCorrelationResponse>> correlate(
            @RequestBody WorkflowCorrelationRequest request) {
        WorkflowCorrelationResponse result = correlationService.correlate(request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

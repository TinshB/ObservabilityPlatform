package com.observability.apm.controller;

import com.observability.apm.dto.*;
import com.observability.apm.service.WorkflowService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Story 12.1, 12.2 — Workflow and Workflow Step REST controller.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Workflows", description = "Business workflow management — define workflow steps spanning multiple services")
public class WorkflowController {

    private final WorkflowService workflowService;

    // ── Workflow endpoints ────────────────────────────────────────────────────────

    @PostMapping("/api/v1/workflows")
    @Operation(summary = "Create a business workflow")
    public ResponseEntity<ApiResponse<WorkflowResponse>> createWorkflow(
            @Valid @RequestBody CreateWorkflowRequest request) {
        WorkflowResponse result = workflowService.createWorkflow(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }

    @GetMapping("/api/v1/workflows")
    @Operation(summary = "List workflows with optional filters")
    public ResponseEntity<ApiResponse<Page<WorkflowResponse>>> listWorkflows(
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<WorkflowResponse> result = workflowService.listWorkflows(enabled, active, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/workflows/{id}")
    @Operation(summary = "Get workflow by ID")
    public ResponseEntity<ApiResponse<WorkflowResponse>> getWorkflow(@PathVariable UUID id) {
        WorkflowResponse result = workflowService.getWorkflow(id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PutMapping("/api/v1/workflows/{id}")
    @Operation(summary = "Update a workflow")
    public ResponseEntity<ApiResponse<WorkflowResponse>> updateWorkflow(
            @PathVariable UUID id,
            @RequestBody UpdateWorkflowRequest request) {
        WorkflowResponse result = workflowService.updateWorkflow(id, request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/api/v1/workflows/{id}")
    @Operation(summary = "Delete a workflow (cascades to steps and instances)")
    public ResponseEntity<Void> deleteWorkflow(@PathVariable UUID id) {
        workflowService.deleteWorkflow(id);
        return ResponseEntity.noContent().build();
    }

    // ── Step endpoints ───────────────────────────────────────────────────────────

    @PostMapping("/api/v1/workflows/{workflowId}/steps")
    @Operation(summary = "Add a step to a workflow")
    public ResponseEntity<ApiResponse<WorkflowStepResponse>> createStep(
            @PathVariable UUID workflowId,
            @Valid @RequestBody WorkflowStepRequest request) {
        WorkflowStepResponse result = workflowService.createStep(workflowId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }

    @GetMapping("/api/v1/workflows/{workflowId}/steps")
    @Operation(summary = "List all steps for a workflow (ordered)")
    public ResponseEntity<ApiResponse<List<WorkflowStepResponse>>> listSteps(
            @PathVariable UUID workflowId) {
        List<WorkflowStepResponse> result = workflowService.listSteps(workflowId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/workflows/{workflowId}/steps/{stepId}")
    @Operation(summary = "Get a specific workflow step")
    public ResponseEntity<ApiResponse<WorkflowStepResponse>> getStep(
            @PathVariable UUID workflowId,
            @PathVariable UUID stepId) {
        WorkflowStepResponse result = workflowService.getStep(workflowId, stepId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PutMapping("/api/v1/workflows/{workflowId}/steps/{stepId}")
    @Operation(summary = "Update a workflow step")
    public ResponseEntity<ApiResponse<WorkflowStepResponse>> updateStep(
            @PathVariable UUID workflowId,
            @PathVariable UUID stepId,
            @Valid @RequestBody WorkflowStepRequest request) {
        WorkflowStepResponse result = workflowService.updateStep(workflowId, stepId, request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/api/v1/workflows/{workflowId}/steps/{stepId}")
    @Operation(summary = "Delete a workflow step")
    public ResponseEntity<Void> deleteStep(
            @PathVariable UUID workflowId,
            @PathVariable UUID stepId) {
        workflowService.deleteStep(workflowId, stepId);
        return ResponseEntity.noContent().build();
    }
}

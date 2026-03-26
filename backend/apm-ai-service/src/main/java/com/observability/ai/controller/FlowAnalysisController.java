package com.observability.ai.controller;

import com.observability.ai.dto.*;
import com.observability.ai.service.FlowAnalysisService;
import com.observability.ai.service.WorkflowConversionService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai/flow-analysis")
@RequiredArgsConstructor
@Tag(name = "AI Flow Analysis", description = "AI-powered service flow diagram generation and workflow conversion")
public class FlowAnalysisController {

    private final FlowAnalysisService flowAnalysisService;
    private final WorkflowConversionService workflowConversionService;

    // ── Flow Analysis ────────────────────────────────────────────────────────

    @PostMapping
    @Operation(summary = "Start AI flow analysis for selected services")
    public ResponseEntity<ApiResponse<FlowAnalysisStartedDto>> startAnalysis(
            @Valid @RequestBody FlowAnalysisRequestDto request) {
        // userId would normally come from JWT SecurityContext; using a placeholder for now
        UUID userId = getCurrentUserId();
        var result = flowAnalysisService.startAnalysis(request, userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.success(result));
    }

    @GetMapping("/{analysisId}")
    @Operation(summary = "Poll for flow analysis status and results")
    public ResponseEntity<ApiResponse<FlowAnalysisResponseDto>> getAnalysis(
            @PathVariable UUID analysisId) {
        var result = flowAnalysisService.getAnalysis(analysisId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/history")
    @Operation(summary = "Get analysis history for the current user")
    public ResponseEntity<ApiResponse<List<FlowAnalysisResponseDto>>> getHistory() {
        UUID userId = getCurrentUserId();
        var result = flowAnalysisService.getAnalysisHistory(userId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Workflow Conversion ──────────────────────────────────────────────────

    @PostMapping("/{analysisId}/patterns/{patternId}/convert-to-workflow")
    @Operation(summary = "Convert a discovered flow pattern to a monitored workflow")
    public ResponseEntity<ApiResponse<ConvertToWorkflowResponseDto>> convertToWorkflow(
            @PathVariable UUID analysisId,
            @PathVariable UUID patternId,
            @Valid @RequestBody ConvertToWorkflowRequestDto request) {
        var result = workflowConversionService.convertToWorkflow(analysisId, patternId, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(result));
    }

    @GetMapping("/{analysisId}/patterns/{patternId}/sla-suggestions")
    @Operation(summary = "Get AI-suggested SLA thresholds for a flow pattern")
    public ResponseEntity<ApiResponse<SlaSuggestionDto>> suggestSla(
            @PathVariable UUID analysisId,
            @PathVariable UUID patternId) {
        var result = workflowConversionService.suggestSla(analysisId, patternId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/{analysisId}/drift-check")
    @Operation(summary = "Compare discovered patterns against existing workflows for drift detection")
    public ResponseEntity<ApiResponse<DriftCheckResponseDto>> checkDrift(
            @PathVariable UUID analysisId,
            @RequestBody List<UUID> workflowIds) {
        var result = workflowConversionService.checkDrift(analysisId, workflowIds);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Presets ──────────────────────────────────────────────────────────────

    @PostMapping("/presets")
    @Operation(summary = "Save a service selection preset")
    public ResponseEntity<ApiResponse<FlowAnalysisPresetDto>> createPreset(
            @Valid @RequestBody CreatePresetRequestDto request) {
        UUID userId = getCurrentUserId();
        var result = flowAnalysisService.createPreset(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(result));
    }

    @GetMapping("/presets")
    @Operation(summary = "List saved presets for the current user")
    public ResponseEntity<ApiResponse<List<FlowAnalysisPresetDto>>> getPresets() {
        UUID userId = getCurrentUserId();
        var result = flowAnalysisService.getPresets(userId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/presets/{presetId}")
    @Operation(summary = "Delete a saved preset")
    public ResponseEntity<ApiResponse<Void>> deletePreset(@PathVariable UUID presetId) {
        flowAnalysisService.deletePreset(presetId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private UUID getCurrentUserId() {
        // In a real implementation, extract from SecurityContextHolder
        // For now, return a default UUID
        try {
            var auth = org.springframework.security.core.context.SecurityContextHolder
                    .getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof String username) {
                return UUID.nameUUIDFromBytes(username.getBytes());
            }
        } catch (Exception ignored) {}
        return UUID.fromString("00000000-0000-0000-0000-000000000001");
    }
}

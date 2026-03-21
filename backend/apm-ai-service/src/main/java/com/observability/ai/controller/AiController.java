package com.observability.ai.controller;

import com.observability.ai.dto.*;
import com.observability.ai.service.AiService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
@Tag(name = "AI/ML", description = "AI/ML inference endpoints backed by the Python sidecar")
public class AiController {

    private final AiService aiService;

    @PostMapping("/anomaly-detection")
    @Operation(summary = "Detect anomalies in a metric time series")
    public ResponseEntity<ApiResponse<AnomalyDetectionResponseDto>> detectAnomalies(
            @Valid @RequestBody AnomalyDetectionRequestDto request) {
        var result = aiService.detectAnomalies(request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/root-cause")
    @Operation(summary = "Analyze root cause of an incident")
    public ResponseEntity<ApiResponse<RootCauseResponseDto>> analyzeRootCause(
            @Valid @RequestBody RootCauseRequestDto request) {
        var result = aiService.analyzeRootCause(request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/forecast")
    @Operation(summary = "Forecast future metric values")
    public ResponseEntity<ApiResponse<ForecastResponseDto>> forecast(
            @Valid @RequestBody ForecastRequestDto request) {
        var result = aiService.forecast(request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/diagnose-errors")
    @Operation(summary = "Diagnose trace error spans using LLM and suggest fixes")
    public ResponseEntity<ApiResponse<ErrorDiagnosisResponseDto>> diagnoseErrors(
            @Valid @RequestBody ErrorDiagnosisRequestDto request) {
        var result = aiService.diagnoseErrors(request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/health")
    @Operation(summary = "Check health of the Python ML sidecar")
    public ResponseEntity<ApiResponse<Map<String, Object>>> sidecarHealth() {
        var health = aiService.healthCheck();
        return ResponseEntity.ok(ApiResponse.success(health));
    }
}

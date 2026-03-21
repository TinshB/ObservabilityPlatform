package com.observability.apm.controller;

import com.observability.apm.dto.AlertHistoryResponse;
import com.observability.apm.dto.AlertResponse;
import com.observability.apm.service.AlertService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 10.4 — Alert management REST controller.
 * Provides endpoints for listing, querying, acknowledging, and resolving alerts.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Alerts", description = "Alert management — list, query, acknowledge, resolve")
public class AlertController {

    private final AlertService alertService;

    @GetMapping("/api/v1/alerts")
    @Operation(summary = "List alerts with optional filters")
    public ResponseEntity<ApiResponse<Page<AlertResponse>>> listAlerts(
            @RequestParam(required = false) UUID serviceId,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String severity,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AlertResponse> result = alertService.listAlerts(serviceId, state, severity, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/alerts/history")
    @Operation(summary = "Story 11.1: List historical alerts with time-range filters and summary stats")
    public ResponseEntity<ApiResponse<AlertHistoryResponse>> listAlertHistory(
            @RequestParam(required = false) UUID serviceId,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        AlertHistoryResponse result = alertService.listAlertHistory(
                serviceId, state, severity, start, end, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/alerts/{id}")
    @Operation(summary = "Get alert by ID")
    public ResponseEntity<ApiResponse<AlertResponse>> getAlert(@PathVariable UUID id) {
        AlertResponse result = alertService.getAlert(id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/api/v1/alerts/{id}/acknowledge")
    @Operation(summary = "Acknowledge a firing alert")
    public ResponseEntity<ApiResponse<AlertResponse>> acknowledgeAlert(
            @PathVariable UUID id,
            Authentication authentication) {
        String username = authentication != null ? authentication.getName() : "system";
        AlertResponse result = alertService.acknowledgeAlert(id, username);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/api/v1/alerts/{id}/resolve")
    @Operation(summary = "Manually resolve an alert")
    public ResponseEntity<ApiResponse<AlertResponse>> resolveAlert(@PathVariable UUID id) {
        AlertResponse result = alertService.resolveAlert(id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

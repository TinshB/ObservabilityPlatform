package com.observability.apm.controller;

import com.observability.apm.dto.*;
import com.observability.apm.service.DashboardService;
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
 * Story 13.1 — Dashboard CRUD REST controller.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Dashboards", description = "Custom dashboards with JSONB widget configuration")
public class DashboardController {

    private final DashboardService dashboardService;

    @PostMapping("/api/v1/dashboards")
    @Operation(summary = "Create a custom dashboard")
    public ResponseEntity<ApiResponse<DashboardResponse>> createDashboard(
            @Valid @RequestBody CreateDashboardRequest request) {
        DashboardResponse result = dashboardService.createDashboard(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }

    @GetMapping("/api/v1/dashboards")
    @Operation(summary = "List dashboards with optional filters")
    public ResponseEntity<ApiResponse<Page<DashboardResponse>>> listDashboards(
            @RequestParam(required = false) UUID ownerId,
            @RequestParam(required = false) Boolean isTemplate,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<DashboardResponse> result = dashboardService.listDashboards(
                ownerId, isTemplate, search, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/dashboards/templates")
    @Operation(summary = "List predefined dashboard templates")
    public ResponseEntity<ApiResponse<List<DashboardResponse>>> listTemplates() {
        List<DashboardResponse> result = dashboardService.listTemplates();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/dashboards/{id}")
    @Operation(summary = "Get dashboard by ID")
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard(@PathVariable UUID id) {
        DashboardResponse result = dashboardService.getDashboard(id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PutMapping("/api/v1/dashboards/{id}")
    @Operation(summary = "Update a dashboard")
    public ResponseEntity<ApiResponse<DashboardResponse>> updateDashboard(
            @PathVariable UUID id,
            @RequestBody UpdateDashboardRequest request) {
        DashboardResponse result = dashboardService.updateDashboard(id, request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/api/v1/dashboards/{id}")
    @Operation(summary = "Delete a dashboard")
    public ResponseEntity<Void> deleteDashboard(@PathVariable UUID id) {
        dashboardService.deleteDashboard(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/dashboards/{id}/clone")
    @Operation(summary = "Clone a dashboard (useful for creating from templates)")
    public ResponseEntity<ApiResponse<DashboardResponse>> cloneDashboard(
            @PathVariable UUID id,
            @RequestParam UUID ownerId,
            @RequestParam(required = false) String name) {
        DashboardResponse result = dashboardService.cloneDashboard(id, ownerId, name);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }
}

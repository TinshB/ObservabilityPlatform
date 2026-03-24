package com.observability.apm.controller;

import com.observability.apm.dto.AutoRegisterRequest;
import com.observability.apm.dto.CreateServiceRequest;
import com.observability.apm.dto.JaegerServiceInfo;
import com.observability.apm.dto.ServiceFilterResponse;
import com.observability.apm.dto.ServiceResponse;
import com.observability.apm.dto.SignalToggleRequest;
import com.observability.apm.dto.UpdateServiceRequest;
import com.observability.apm.service.JaegerServiceDiscoveryService;
import com.observability.apm.service.ServiceCatalogService;
import com.observability.shared.dto.ApiResponse;
import com.observability.shared.dto.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/services")
@RequiredArgsConstructor
@Tag(name = "Service Catalog", description = "Service registration, discovery, and signal management")
public class ServiceController {

    private final ServiceCatalogService serviceCatalogService;
    private final JaegerServiceDiscoveryService jaegerDiscoveryService;

    // ── Story 4.5: Auto-register from OTel pipeline ─────────────────────────────

    @PostMapping("/auto-register")
    @Operation(summary = "Auto-register service",
            description = "Called by the OTel Collector pipeline when telemetry with a new service.name is received. Idempotent.")
    public ResponseEntity<ApiResponse<ServiceResponse>> autoRegister(
            @RequestBody @Valid AutoRegisterRequest request) {
        ServiceResponse service = serviceCatalogService.autoRegister(request);
        return ResponseEntity.ok(ApiResponse.success(service, "Service registered"));
    }

    // ── Story 4.6: Manual service registration ──────────────────────────────────

    @PostMapping
    @Operation(summary = "Register service manually",
            description = "Manually register a service with ownership, team, environment, and tier metadata")
    public ResponseEntity<ApiResponse<ServiceResponse>> createService(
            @RequestBody @Valid CreateServiceRequest request) {
        ServiceResponse service = serviceCatalogService.createService(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(service));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update service metadata",
            description = "Update description, owner team, environment, tier, or active status")
    public ResponseEntity<ApiResponse<ServiceResponse>> updateService(
            @PathVariable UUID id,
            @RequestBody @Valid UpdateServiceRequest request) {
        ServiceResponse service = serviceCatalogService.updateService(id, request);
        return ResponseEntity.ok(ApiResponse.success(service, "Service updated successfully"));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Deactivate service",
            description = "Soft-delete a service by setting is_active to false")
    public ResponseEntity<ApiResponse<Void>> deactivateService(@PathVariable UUID id) {
        serviceCatalogService.deactivateService(id);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    // ── Story 4.7: Signal toggle ────────────────────────────────────────────────

    @PatchMapping("/{id}/signals")
    @Operation(summary = "Toggle signals",
            description = "Enable or disable metrics, logs, and/or traces for a service. Null fields are left unchanged.")
    public ResponseEntity<ApiResponse<ServiceResponse>> toggleSignals(
            @PathVariable UUID id,
            @RequestBody @Valid SignalToggleRequest request) {
        ServiceResponse service = serviceCatalogService.toggleSignals(id, request);
        return ResponseEntity.ok(ApiResponse.success(service, "Signal toggles updated"));
    }

    // ── Story 4.8: List / search / filter (backend support for UI) ──────────────

    @GetMapping
    @Operation(summary = "List services",
            description = "Retrieve a paginated list of services with optional search and filters")
    public ResponseEntity<ApiResponse<PagedResponse<ServiceResponse>>> listServices(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String environment,
            @RequestParam(required = false) String team,
            @RequestParam(required = false) String tier,
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<ServiceResponse> page = serviceCatalogService.listServices(
                search, environment, team, tier, active, pageable);
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.from(page)));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get service",
            description = "Retrieve a single service by ID")
    public ResponseEntity<ApiResponse<ServiceResponse>> getService(@PathVariable UUID id) {
        ServiceResponse service = serviceCatalogService.getServiceById(id);
        return ResponseEntity.ok(ApiResponse.success(service));
    }

    @GetMapping("/filters")
    @Operation(summary = "Get filter options",
            description = "Returns distinct environments, teams, and tiers for use in UI dropdowns")
    public ResponseEntity<ApiResponse<ServiceFilterResponse>> getFilterOptions() {
        ServiceFilterResponse filters = serviceCatalogService.getFilterOptions();
        return ResponseEntity.ok(ApiResponse.success(filters));
    }

    // ── Jaeger-based service discovery ────────────────────────────────────────

    @GetMapping("/discover")
    @Operation(summary = "Discover services from Jaeger",
            description = "Lists all services known to Jaeger with their type (language), error rate, and throughput")
    public ResponseEntity<ApiResponse<List<JaegerServiceInfo>>> discoverServices(
            @RequestParam(defaultValue = "900") long lookbackSeconds) {
        List<JaegerServiceInfo> services = jaegerDiscoveryService.discoverServices(lookbackSeconds);
        return ResponseEntity.ok(ApiResponse.success(services));
    }
}

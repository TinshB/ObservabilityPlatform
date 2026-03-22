package com.observability.billing.controller;

import com.observability.billing.dto.CreateLicenceTierRequest;
import com.observability.billing.dto.LicenceCostSummaryResponse;
import com.observability.billing.dto.LicenceTierResponse;
import com.observability.billing.dto.UpdateLicenceTierRequest;
import com.observability.billing.service.LicenceSummaryService;
import com.observability.billing.service.LicenceTierService;
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

/**
 * US-BILL-009 / US-BILL-010 — Licence billing REST controller.
 * CRUD endpoints for managing licence tiers and viewing cost summaries.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Billing — Licences", description = "Licence tier configuration and cost management")
public class LicenceBillingController {

    private final LicenceTierService licenceTierService;
    private final LicenceSummaryService licenceSummaryService;

    /**
     * US-BILL-010: View licence cost summary.
     * Returns user type, user count, cost per user, and total cost per tier.
     */
    @GetMapping("/api/v1/billing/licences")
    @Operation(summary = "Get licence cost summary with user counts per tier")
    public ResponseEntity<ApiResponse<LicenceCostSummaryResponse>> getLicenceSummary() {
        LicenceCostSummaryResponse result = licenceSummaryService.getSummary();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PostMapping("/api/v1/billing/licences/tiers")
    @Operation(summary = "Create a licence tier")
    public ResponseEntity<ApiResponse<LicenceTierResponse>> createTier(
            @Valid @RequestBody CreateLicenceTierRequest request) {
        LicenceTierResponse result = licenceTierService.createTier(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(result));
    }

    @GetMapping("/api/v1/billing/licences/tiers")
    @Operation(summary = "List all licence tiers")
    public ResponseEntity<ApiResponse<List<LicenceTierResponse>>> listTiers() {
        List<LicenceTierResponse> result = licenceTierService.listAllTiers();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/billing/licences/tiers/{id}")
    @Operation(summary = "Get a licence tier by ID")
    public ResponseEntity<ApiResponse<LicenceTierResponse>> getTier(@PathVariable UUID id) {
        LicenceTierResponse result = licenceTierService.getTier(id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PutMapping("/api/v1/billing/licences/tiers/{id}")
    @Operation(summary = "Update a licence tier")
    public ResponseEntity<ApiResponse<LicenceTierResponse>> updateTier(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateLicenceTierRequest request) {
        LicenceTierResponse result = licenceTierService.updateTier(id, request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/api/v1/billing/licences/tiers/{id}")
    @Operation(summary = "Delete a licence tier (must be inactive)")
    public ResponseEntity<Void> deleteTier(@PathVariable UUID id) {
        licenceTierService.deleteTier(id);
        return ResponseEntity.noContent().build();
    }
}

package com.observability.apm.controller;

import com.observability.apm.dto.CreateSlaRuleRequest;
import com.observability.apm.dto.SlaRuleResponse;
import com.observability.apm.dto.UpdateSlaRuleRequest;
import com.observability.apm.service.SlaRuleService;
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

import java.util.UUID;

/**
 * Story 10.1 — SLA Rule CRUD REST controller.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "SLA Rules", description = "SLA rule management — create, read, update, delete threshold conditions")
public class SlaRuleController {

    private final SlaRuleService slaRuleService;

    @PostMapping("/api/v1/sla-rules")
    @Operation(summary = "Create an SLA rule")
    public ResponseEntity<ApiResponse<SlaRuleResponse>> createRule(
            @Valid @RequestBody CreateSlaRuleRequest request) {
        SlaRuleResponse result = slaRuleService.createRule(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/sla-rules")
    @Operation(summary = "List SLA rules with optional filters")
    public ResponseEntity<ApiResponse<Page<SlaRuleResponse>>> listRules(
            @RequestParam(required = false) UUID serviceId,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<SlaRuleResponse> result = slaRuleService.listRules(serviceId, enabled, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/sla-rules/{id}")
    @Operation(summary = "Get SLA rule by ID")
    public ResponseEntity<ApiResponse<SlaRuleResponse>> getRule(@PathVariable UUID id) {
        SlaRuleResponse result = slaRuleService.getRule(id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PutMapping("/api/v1/sla-rules/{id}")
    @Operation(summary = "Update an SLA rule")
    public ResponseEntity<ApiResponse<SlaRuleResponse>> updateRule(
            @PathVariable UUID id,
            @RequestBody UpdateSlaRuleRequest request) {
        SlaRuleResponse result = slaRuleService.updateRule(id, request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/api/v1/sla-rules/{id}")
    @Operation(summary = "Delete an SLA rule")
    public ResponseEntity<Void> deleteRule(@PathVariable UUID id) {
        slaRuleService.deleteRule(id);
        return ResponseEntity.noContent().build();
    }
}

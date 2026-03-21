package com.observability.report.controller;

import com.observability.report.dto.*;
import com.observability.report.synthetic.SyntheticCheckService;
import com.observability.report.synthetic.SyntheticResultService;
import com.observability.shared.dto.ApiResponse;
import com.observability.shared.dto.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/synthetic-checks")
@RequiredArgsConstructor
@Tag(name = "Synthetic Monitoring", description = "CRUD for synthetic checks and probe results")
public class SyntheticCheckController {

    private final SyntheticCheckService checkService;
    private final SyntheticResultService resultService;

    @PostMapping
    @Operation(summary = "Create a synthetic check")
    public ResponseEntity<ApiResponse<SyntheticCheckResponse>> createCheck(
            @RequestBody @Valid CreateSyntheticCheckRequest request,
            Authentication authentication) {
        String createdBy = authentication.getName();
        SyntheticCheckResponse response = checkService.createCheck(request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @GetMapping("/{checkId}")
    @Operation(summary = "Get a synthetic check by ID")
    public ResponseEntity<ApiResponse<SyntheticCheckResponse>> getCheck(@PathVariable UUID checkId) {
        SyntheticCheckResponse response = checkService.getCheck(checkId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @Operation(summary = "List synthetic checks with optional filters")
    public ResponseEntity<ApiResponse<PagedResponse<SyntheticCheckResponse>>> listChecks(
            @Parameter(description = "Filter by active status")
            @RequestParam(required = false) Boolean active,
            @Parameter(description = "Filter by service name")
            @RequestParam(required = false) String serviceName,
            @PageableDefault(size = 20) Pageable pageable) {
        var page = checkService.listChecks(active, serviceName, pageable);
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.from(page)));
    }

    @PutMapping("/{checkId}")
    @Operation(summary = "Update a synthetic check")
    public ResponseEntity<ApiResponse<SyntheticCheckResponse>> updateCheck(
            @PathVariable UUID checkId,
            @RequestBody @Valid UpdateSyntheticCheckRequest request) {
        SyntheticCheckResponse response = checkService.updateCheck(checkId, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{checkId}")
    @Operation(summary = "Delete a synthetic check")
    public ResponseEntity<ApiResponse<Void>> deleteCheck(@PathVariable UUID checkId) {
        checkService.deleteCheck(checkId);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    // ── Probe Results ────────────────────────────────────────────────────────

    @GetMapping("/{checkId}/results")
    @Operation(summary = "Get probe results for a synthetic check")
    public ResponseEntity<ApiResponse<PagedResponse<SyntheticResultResponse>>> getResults(
            @PathVariable UUID checkId,
            @PageableDefault(size = 20) Pageable pageable) {
        var page = resultService.getResults(checkId, pageable);
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.from(page)));
    }

    @GetMapping("/{checkId}/results/recent")
    @Operation(summary = "Get the 10 most recent probe results")
    public ResponseEntity<ApiResponse<List<SyntheticResultResponse>>> getRecentResults(
            @PathVariable UUID checkId) {
        List<SyntheticResultResponse> results = resultService.getRecentResults(checkId);
        return ResponseEntity.ok(ApiResponse.success(results));
    }
}

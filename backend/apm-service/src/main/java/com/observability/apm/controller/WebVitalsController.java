package com.observability.apm.controller;

import com.observability.apm.dto.WebVitalReport;
import com.observability.apm.service.WebVitalsIngestService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Ingestion endpoint for Core Web Vitals reported by the browser OTel SDK.
 * The browser POSTs measurements here; the service records them as Micrometer
 * histograms that Prometheus scrapes from /actuator/prometheus.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Web Vitals", description = "Browser Core Web Vitals ingestion")
public class WebVitalsController {

    private final WebVitalsIngestService ingestService;

    @PostMapping("/api/v1/web-vitals")
    @Operation(summary = "Report a single Core Web Vital measurement from the browser")
    public ResponseEntity<ApiResponse<Void>> reportVital(
            @Valid @RequestBody WebVitalReport report) {
        ingestService.record(report);
        return ResponseEntity.ok(ApiResponse.success(null, "recorded"));
    }

    @PostMapping("/api/v1/web-vitals/batch")
    @Operation(summary = "Report multiple Core Web Vital measurements in a single call")
    public ResponseEntity<ApiResponse<Void>> reportVitalsBatch(
            @Valid @RequestBody List<WebVitalReport> reports) {
        reports.forEach(ingestService::record);
        return ResponseEntity.ok(ApiResponse.success(null, reports.size() + " recorded"));
    }
}

package com.observability.billing.controller;

import com.observability.billing.dto.ElasticsearchStorageResponse;
import com.observability.billing.dto.JaegerStorageResponse;
import com.observability.billing.dto.PrometheusStorageResponse;
import com.observability.billing.dto.StorageSummaryResponse;
import com.observability.billing.service.ElasticsearchStorageService;
import com.observability.billing.service.JaegerStorageService;
import com.observability.billing.service.PrometheusStorageService;
import com.observability.billing.service.StorageSummaryService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * US-BILL-001 / US-BILL-002 / US-BILL-003 — Storage billing REST controller.
 * Provides endpoints for viewing storage costs across backends.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Billing — Storage", description = "Storage cost tracking for Elasticsearch, Prometheus, and Jaeger")
public class StorageBillingController {

    private final ElasticsearchStorageService elasticsearchStorageService;
    private final PrometheusStorageService prometheusStorageService;
    private final JaegerStorageService jaegerStorageService;
    private final StorageSummaryService storageSummaryService;

    /**
     * US-BILL-004: Unified storage cost summary across all backends.
     * Returns aggregated size and cost for Elasticsearch, Prometheus, and Jaeger.
     */
    @GetMapping("/api/v1/billing/storage")
    @Operation(summary = "Get unified storage cost summary across all backends")
    public ResponseEntity<ApiResponse<StorageSummaryResponse>> getStorageSummary() {
        StorageSummaryResponse result = storageSummaryService.getSummary();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * US-BILL-001: View Elasticsearch storage usage.
     * Returns total storage size, document count, per-index breakdown, and cost in USD.
     */
    @GetMapping("/api/v1/billing/storage/elasticsearch")
    @Operation(summary = "Get Elasticsearch storage details with cost breakdown")
    public ResponseEntity<ApiResponse<ElasticsearchStorageResponse>> getElasticsearchStorage() {
        ElasticsearchStorageResponse result = elasticsearchStorageService.getStorageDetails();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * US-BILL-002: View Prometheus storage usage.
     * Returns total TSDB size, active series count, retention info,
     * per-service series breakdown, and cost in USD.
     */
    @GetMapping("/api/v1/billing/storage/prometheus")
    @Operation(summary = "Get Prometheus storage details with cost breakdown")
    public ResponseEntity<ApiResponse<PrometheusStorageResponse>> getPrometheusStorage() {
        PrometheusStorageResponse result = prometheusStorageService.getStorageDetails();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /**
     * US-BILL-003: View Jaeger trace storage usage.
     * Returns total trace storage size, span/trace counts,
     * per-service span breakdown, and cost in USD.
     */
    @GetMapping("/api/v1/billing/storage/jaeger")
    @Operation(summary = "Get Jaeger trace storage details with cost breakdown")
    public ResponseEntity<ApiResponse<JaegerStorageResponse>> getJaegerStorage() {
        JaegerStorageResponse result = jaegerStorageService.getStorageDetails();
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

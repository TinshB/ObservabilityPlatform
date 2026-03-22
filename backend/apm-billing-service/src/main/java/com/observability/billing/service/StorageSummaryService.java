package com.observability.billing.service;

import com.observability.billing.dto.ElasticsearchStorageResponse;
import com.observability.billing.dto.JaegerStorageResponse;
import com.observability.billing.dto.PrometheusStorageResponse;
import com.observability.billing.dto.StorageSummaryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * US-BILL-004 — Aggregates storage data from all three backends
 * into a unified cost summary.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StorageSummaryService {

    private final ElasticsearchStorageService elasticsearchStorageService;
    private final PrometheusStorageService prometheusStorageService;
    private final JaegerStorageService jaegerStorageService;

    /**
     * Get unified storage cost summary across all backends.
     * Acceptance criteria:
     * - AC1: Stacked bar/pie chart data with ES, Prometheus, and Jaeger costs
     * - AC2: Costs calculated using configured rate cards
     * - AC3: Backend name, data size, and cost in USD per segment
     */
    public StorageSummaryResponse getSummary() {
        ElasticsearchStorageResponse es = fetchElasticsearch();
        PrometheusStorageResponse prom = fetchPrometheus();
        JaegerStorageResponse jaeger = fetchJaeger();

        long totalBytes = es.getTotalStorageSizeBytes()
                + prom.getTotalStorageSizeBytes()
                + jaeger.getTotalStorageSizeBytes();

        double totalCost = roundCost(es.getTotalCostUsd()
                + prom.getTotalCostUsd()
                + jaeger.getTotalCostUsd());

        return StorageSummaryResponse.builder()
                .elasticsearchSizeBytes(es.getTotalStorageSizeBytes())
                .elasticsearchSizeFormatted(es.getTotalStorageSizeFormatted())
                .elasticsearchCostUsd(es.getTotalCostUsd())
                .prometheusSizeBytes(prom.getTotalStorageSizeBytes())
                .prometheusSizeFormatted(prom.getTotalStorageSizeFormatted())
                .prometheusCostUsd(prom.getTotalCostUsd())
                .jaegerSizeBytes(jaeger.getTotalStorageSizeBytes())
                .jaegerSizeFormatted(jaeger.getTotalStorageSizeFormatted())
                .jaegerCostUsd(jaeger.getTotalCostUsd())
                .totalSizeBytes(totalBytes)
                .totalSizeFormatted(formatBytes(totalBytes))
                .totalCostUsd(totalCost)
                .build();
    }

    private ElasticsearchStorageResponse fetchElasticsearch() {
        try {
            return elasticsearchStorageService.getStorageDetails();
        } catch (Exception ex) {
            log.error("Failed to fetch Elasticsearch storage for summary: {}", ex.getMessage());
            return ElasticsearchStorageResponse.builder()
                    .totalStorageSizeBytes(0).totalStorageSizeFormatted("0 B")
                    .totalDocumentCount(0).indexCount(0)
                    .costPerGbUsd(0).totalCostUsd(0)
                    .indices(java.util.List.of()).build();
        }
    }

    private PrometheusStorageResponse fetchPrometheus() {
        try {
            return prometheusStorageService.getStorageDetails();
        } catch (Exception ex) {
            log.error("Failed to fetch Prometheus storage for summary: {}", ex.getMessage());
            return PrometheusStorageResponse.builder()
                    .totalStorageSizeBytes(0).totalStorageSizeFormatted("0 B")
                    .totalActiveSeries(0).totalLabelValuePairs(0)
                    .retentionPeriod("unknown").costPerGbUsd(0).totalCostUsd(0)
                    .services(java.util.List.of()).build();
        }
    }

    private JaegerStorageResponse fetchJaeger() {
        try {
            return jaegerStorageService.getStorageDetails();
        } catch (Exception ex) {
            log.error("Failed to fetch Jaeger storage for summary: {}", ex.getMessage());
            return JaegerStorageResponse.builder()
                    .totalStorageSizeBytes(0).totalStorageSizeFormatted("0 B")
                    .totalSpanCount(0).totalTraceCount(0).indexCount(0)
                    .costPerGbUsd(0).totalCostUsd(0)
                    .services(java.util.List.of()).build();
        }
    }

    static String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + " B";
        double kb = bytes / 1024.0;
        if (kb < 1024) return String.format("%.2f KB", kb);
        double mb = kb / 1024.0;
        if (mb < 1024) return String.format("%.2f MB", mb);
        double gb = mb / 1024.0;
        if (gb < 1024) return String.format("%.2f GB", gb);
        double tb = gb / 1024.0;
        return String.format("%.2f TB", tb);
    }

    private static double roundCost(double cost) {
        return BigDecimal.valueOf(cost)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }
}

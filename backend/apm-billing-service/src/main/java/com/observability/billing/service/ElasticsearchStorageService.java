package com.observability.billing.service;

import com.observability.billing.dto.ElasticsearchStorageResponse;
import com.observability.billing.dto.IndexStorageDetail;
import com.observability.billing.elasticsearch.ElasticsearchStorageClient;
import com.observability.billing.entity.BillingRateCardEntity;
import com.observability.billing.repository.BillingRateCardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

/**
 * US-BILL-001 — Service for calculating Elasticsearch storage costs.
 * Fetches storage data from Elasticsearch and applies rate cards for cost calculation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ElasticsearchStorageService {

    private static final String CATEGORY_STORAGE = "STORAGE";
    private static final String RESOURCE_TYPE_ES_GB = "elasticsearch_gb";
    private static final double BYTES_PER_GB = 1_073_741_824.0;

    /** Default cost per GB if no rate card is configured. */
    private static final BigDecimal DEFAULT_COST_PER_GB = new BigDecimal("0.25");

    private final ElasticsearchStorageClient esStorageClient;
    private final BillingRateCardRepository rateCardRepository;

    /**
     * Get Elasticsearch storage details with cost breakdown.
     * Acceptance criteria:
     * - AC1: Display total ES storage in GB/TB with cost in USD
     * - AC2: Per-index size, document count, and shard count
     * - AC3: Time range filtering (handled at controller level via index pattern)
     */
    public ElasticsearchStorageResponse getStorageDetails() {
        BigDecimal costPerGb = getActiveCostPerGb();

        List<IndexStorageDetail> indices = esStorageClient.getIndexStorageDetails();

        // Enrich each index with formatted size and cost
        long totalSizeBytes = 0;
        long totalDocCount = 0;
        for (IndexStorageDetail index : indices) {
            totalSizeBytes += index.getStorageSizeBytes();
            totalDocCount += index.getDocumentCount();

            double sizeGb = index.getStorageSizeBytes() / BYTES_PER_GB;
            index.setStorageSizeFormatted(formatBytes(index.getStorageSizeBytes()));
            index.setCostUsd(roundCost(sizeGb * costPerGb.doubleValue()));
        }

        double totalSizeGb = totalSizeBytes / BYTES_PER_GB;
        double totalCost = roundCost(totalSizeGb * costPerGb.doubleValue());

        return ElasticsearchStorageResponse.builder()
                .totalStorageSizeBytes(totalSizeBytes)
                .totalStorageSizeFormatted(formatBytes(totalSizeBytes))
                .totalDocumentCount(totalDocCount)
                .indexCount(indices.size())
                .costPerGbUsd(costPerGb.doubleValue())
                .totalCostUsd(totalCost)
                .indices(indices)
                .build();
    }

    /**
     * Look up the active Elasticsearch storage rate card.
     * Falls back to a default rate if none is configured.
     */
    private BigDecimal getActiveCostPerGb() {
        return rateCardRepository
                .findActiveRate(CATEGORY_STORAGE, RESOURCE_TYPE_ES_GB, Instant.now())
                .map(BillingRateCardEntity::getUnitCostUsd)
                .orElseGet(() -> {
                    log.warn("No active rate card found for {}/{}. Using default: ${}/GB",
                            CATEGORY_STORAGE, RESOURCE_TYPE_ES_GB, DEFAULT_COST_PER_GB);
                    return DEFAULT_COST_PER_GB;
                });
    }

    /**
     * Format bytes into a human-readable string (KB, MB, GB, TB).
     */
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

    /**
     * Round a cost value to 2 decimal places.
     */
    private static double roundCost(double cost) {
        return BigDecimal.valueOf(cost)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }
}

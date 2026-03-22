package com.observability.billing.service;

import com.observability.billing.dto.JaegerStorageResponse;
import com.observability.billing.dto.ServiceSpanDetail;
import com.observability.billing.elasticsearch.JaegerStorageClient;
import com.observability.billing.entity.BillingRateCardEntity;
import com.observability.billing.repository.BillingRateCardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * US-BILL-003 — Service for calculating Jaeger trace storage costs.
 * Fetches trace data from the Jaeger Query API and applies rate cards
 * for cost calculation. Storage is estimated from span counts using
 * a configurable average span size.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JaegerStorageService {

    private static final String CATEGORY_STORAGE = "STORAGE";
    private static final String RESOURCE_TYPE_JAEGER_GB = "jaeger_gb";
    private static final double BYTES_PER_GB = 1_073_741_824.0;

    /** Default cost per GB if no rate card is configured. */
    private static final BigDecimal DEFAULT_COST_PER_GB = new BigDecimal("0.20");

    private final JaegerStorageClient jaegerClient;
    private final BillingRateCardRepository rateCardRepository;

    /**
     * Get Jaeger storage details with cost breakdown.
     * Queries the Jaeger Query API for service/trace/span data
     * and estimates storage based on span counts.
     */
    public JaegerStorageResponse getStorageDetails() {
        BigDecimal costPerGb = getActiveCostPerGb();

        // Fetch per-service span breakdown via Jaeger API
        Map<String, Long> spansByService = jaegerClient.getSpanCountByService();

        long totalSpanCount = spansByService.values().stream()
                .mapToLong(Long::longValue).sum();
        long totalTraceCount = jaegerClient.getDistinctTraceCount();

        // Estimate total storage from span count
        long totalSizeBytes = jaegerClient.estimateStorageBytes(totalSpanCount);

        // Build per-service breakdown
        List<ServiceSpanDetail> services = buildServiceBreakdown(
                spansByService, totalSpanCount, totalSizeBytes, totalTraceCount, costPerGb);

        double totalSizeGb = totalSizeBytes / BYTES_PER_GB;
        double totalCost = roundCost(totalSizeGb * costPerGb.doubleValue());

        int serviceCount = spansByService.size();

        return JaegerStorageResponse.builder()
                .totalStorageSizeBytes(totalSizeBytes)
                .totalStorageSizeFormatted(formatBytes(totalSizeBytes))
                .totalSpanCount(totalSpanCount)
                .totalTraceCount(totalTraceCount)
                .indexCount(serviceCount)
                .costPerGbUsd(costPerGb.doubleValue())
                .totalCostUsd(totalCost)
                .services(services)
                .build();
    }

    private List<ServiceSpanDetail> buildServiceBreakdown(
            Map<String, Long> spansByService,
            long totalSpanCount,
            long totalStorageBytes,
            long totalTraceCount,
            BigDecimal costPerGb) {

        List<ServiceSpanDetail> services = new ArrayList<>();

        for (Map.Entry<String, Long> entry : spansByService.entrySet()) {
            String serviceName = entry.getKey();
            long spanCount = entry.getValue();

            double spanPercentage = totalSpanCount > 0
                    ? (spanCount * 100.0) / totalSpanCount
                    : 0.0;

            long estimatedBytes = totalSpanCount > 0
                    ? (long) ((double) spanCount / totalSpanCount * totalStorageBytes)
                    : 0;

            long estimatedTraces = totalSpanCount > 0
                    ? (long) ((double) spanCount / totalSpanCount * totalTraceCount)
                    : 0;

            double estimatedGb = estimatedBytes / BYTES_PER_GB;
            double estimatedCost = roundCost(estimatedGb * costPerGb.doubleValue());

            services.add(ServiceSpanDetail.builder()
                    .serviceName(serviceName)
                    .spanCount(spanCount)
                    .traceCount(estimatedTraces)
                    .spanPercentage(roundPercentage(spanPercentage))
                    .estimatedStorageBytes(estimatedBytes)
                    .estimatedStorageFormatted(formatBytes(estimatedBytes))
                    .estimatedCostUsd(estimatedCost)
                    .build());
        }

        return services;
    }

    private BigDecimal getActiveCostPerGb() {
        return rateCardRepository
                .findActiveRate(CATEGORY_STORAGE, RESOURCE_TYPE_JAEGER_GB, Instant.now())
                .map(BillingRateCardEntity::getUnitCostUsd)
                .orElseGet(() -> {
                    log.warn("No active rate card found for {}/{}. Using default: ${}/GB",
                            CATEGORY_STORAGE, RESOURCE_TYPE_JAEGER_GB, DEFAULT_COST_PER_GB);
                    return DEFAULT_COST_PER_GB;
                });
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

    private static double roundPercentage(double pct) {
        return BigDecimal.valueOf(pct)
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
    }
}

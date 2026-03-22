package com.observability.billing.service;

import com.observability.billing.dto.PrometheusStorageResponse;
import com.observability.billing.dto.ServiceSeriesDetail;
import com.observability.billing.entity.BillingRateCardEntity;
import com.observability.billing.prometheus.PrometheusStorageClient;
import com.observability.billing.prometheus.PrometheusStorageClient.TsdbStatus;
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
 * US-BILL-002 — Service for calculating Prometheus storage costs.
 * Fetches TSDB status and per-service series counts from Prometheus
 * and applies rate cards for cost calculation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PrometheusStorageService {

    private static final String CATEGORY_STORAGE = "STORAGE";
    private static final String RESOURCE_TYPE_PROM_GB = "prometheus_gb";
    private static final double BYTES_PER_GB = 1_073_741_824.0;

    /** Default cost per GB if no rate card is configured. */
    private static final BigDecimal DEFAULT_COST_PER_GB = new BigDecimal("0.15");

    private final PrometheusStorageClient prometheusClient;
    private final BillingRateCardRepository rateCardRepository;

    /**
     * Get Prometheus storage details with cost breakdown.
     * Acceptance criteria:
     * - AC1: Display total TSDB block size, active series count, and retention-adjusted cost
     * - AC2: Per-service series count and estimated storage contribution
     * - AC3: Time range filtering (inherently handled by retention period)
     */
    public PrometheusStorageResponse getStorageDetails() {
        BigDecimal costPerGb = getActiveCostPerGb();

        // Fetch TSDB stats
        TsdbStatus tsdbStatus = prometheusClient.getTsdbStatus();
        long storageSizeBytes = prometheusClient.getTsdbStorageSizeBytes();
        String retentionPeriod = prometheusClient.getRetentionPeriod();

        // Fetch per-service series counts
        Map<String, Long> seriesByJob = prometheusClient.getSeriesCountByJob();
        long totalSeries = tsdbStatus.numSeries();

        // If TSDB status returned 0 series but we got per-job data, use the sum
        if (totalSeries == 0 && !seriesByJob.isEmpty()) {
            totalSeries = seriesByJob.values().stream().mapToLong(Long::longValue).sum();
        }

        // Build per-service breakdown with estimated storage contribution
        List<ServiceSeriesDetail> services = buildServiceBreakdown(
                seriesByJob, totalSeries, storageSizeBytes, costPerGb);

        double totalSizeGb = storageSizeBytes / BYTES_PER_GB;
        double totalCost = roundCost(totalSizeGb * costPerGb.doubleValue());

        return PrometheusStorageResponse.builder()
                .totalStorageSizeBytes(storageSizeBytes)
                .totalStorageSizeFormatted(formatBytes(storageSizeBytes))
                .totalActiveSeries(totalSeries)
                .totalLabelValuePairs(tsdbStatus.numLabelPairs())
                .retentionPeriod(retentionPeriod)
                .costPerGbUsd(costPerGb.doubleValue())
                .totalCostUsd(totalCost)
                .services(services)
                .build();
    }

    /**
     * Build per-service breakdown, estimating storage contribution proportional to series count.
     */
    private List<ServiceSeriesDetail> buildServiceBreakdown(
            Map<String, Long> seriesByJob,
            long totalSeries,
            long totalStorageBytes,
            BigDecimal costPerGb) {

        List<ServiceSeriesDetail> services = new ArrayList<>();

        for (Map.Entry<String, Long> entry : seriesByJob.entrySet()) {
            String jobName = entry.getKey();
            long seriesCount = entry.getValue();

            double seriesPercentage = totalSeries > 0
                    ? (seriesCount * 100.0) / totalSeries
                    : 0.0;

            // Estimate storage proportional to series count
            long estimatedBytes = totalSeries > 0
                    ? (long) ((double) seriesCount / totalSeries * totalStorageBytes)
                    : 0;

            double estimatedGb = estimatedBytes / BYTES_PER_GB;
            double estimatedCost = roundCost(estimatedGb * costPerGb.doubleValue());

            services.add(ServiceSeriesDetail.builder()
                    .serviceName(jobName)
                    .seriesCount(seriesCount)
                    .seriesPercentage(roundPercentage(seriesPercentage))
                    .estimatedStorageBytes(estimatedBytes)
                    .estimatedStorageFormatted(formatBytes(estimatedBytes))
                    .estimatedCostUsd(estimatedCost)
                    .build());
        }

        return services;
    }

    /**
     * Look up the active Prometheus storage rate card.
     */
    private BigDecimal getActiveCostPerGb() {
        return rateCardRepository
                .findActiveRate(CATEGORY_STORAGE, RESOURCE_TYPE_PROM_GB, Instant.now())
                .map(BillingRateCardEntity::getUnitCostUsd)
                .orElseGet(() -> {
                    log.warn("No active rate card found for {}/{}. Using default: ${}/GB",
                            CATEGORY_STORAGE, RESOURCE_TYPE_PROM_GB, DEFAULT_COST_PER_GB);
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

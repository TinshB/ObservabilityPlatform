package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * US-BILL-002 — Per-service series count and estimated storage contribution.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceSeriesDetail {

    /** Service/job name from Prometheus. */
    private String serviceName;

    /** Number of active time series for this service. */
    private long seriesCount;

    /** Percentage of total series this service represents. */
    private double seriesPercentage;

    /** Estimated storage contribution in bytes. */
    private long estimatedStorageBytes;

    /** Estimated storage formatted (e.g., "1.23 GB"). */
    private String estimatedStorageFormatted;

    /** Estimated cost in USD based on storage contribution. */
    private double estimatedCostUsd;
}

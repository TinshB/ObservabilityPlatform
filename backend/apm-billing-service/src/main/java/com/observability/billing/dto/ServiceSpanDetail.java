package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * US-BILL-003 — Per-service span count and storage contribution from Jaeger.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceSpanDetail {

    /** Service name from Jaeger traces. */
    private String serviceName;

    /** Total span count for this service. */
    private long spanCount;

    /** Total trace (root span) count for this service. */
    private long traceCount;

    /** Percentage of total spans this service represents. */
    private double spanPercentage;

    /** Estimated storage size in bytes. */
    private long estimatedStorageBytes;

    /** Estimated storage formatted (e.g., "512.30 MB"). */
    private String estimatedStorageFormatted;

    /** Estimated cost in USD based on storage contribution. */
    private double estimatedCostUsd;
}

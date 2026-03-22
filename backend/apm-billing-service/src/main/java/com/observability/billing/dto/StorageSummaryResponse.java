package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * US-BILL-004 — Unified storage cost summary across all backends.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StorageSummaryResponse {

    /** Elasticsearch storage size in bytes. */
    private long elasticsearchSizeBytes;
    private String elasticsearchSizeFormatted;
    private double elasticsearchCostUsd;

    /** Prometheus storage size in bytes. */
    private long prometheusSizeBytes;
    private String prometheusSizeFormatted;
    private double prometheusCostUsd;

    /** Jaeger storage size in bytes. */
    private long jaegerSizeBytes;
    private String jaegerSizeFormatted;
    private double jaegerCostUsd;

    /** Grand total across all backends. */
    private long totalSizeBytes;
    private String totalSizeFormatted;
    private double totalCostUsd;
}

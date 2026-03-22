package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * US-BILL-002 — Prometheus storage usage response.
 * Contains TSDB summary, retention info, and per-service series breakdown.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrometheusStorageResponse {

    /** Total TSDB storage size in bytes. */
    private long totalStorageSizeBytes;

    /** Total storage formatted (e.g., "4.52 GB"). */
    private String totalStorageSizeFormatted;

    /** Total number of active time series. */
    private long totalActiveSeries;

    /** Number of label-value pairs in TSDB. */
    private long totalLabelValuePairs;

    /** Configured retention period (e.g., "15d"). */
    private String retentionPeriod;

    /** Cost per GB in USD (from rate card). */
    private double costPerGbUsd;

    /** Total estimated cost in USD (retention-adjusted). */
    private double totalCostUsd;

    /** Per-service series breakdown. */
    private List<ServiceSeriesDetail> services;
}

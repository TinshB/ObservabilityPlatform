package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * US-BILL-003 — Jaeger trace storage usage response.
 * Contains total trace storage summary and per-service span breakdown.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JaegerStorageResponse {

    /** Total trace storage size in bytes. */
    private long totalStorageSizeBytes;

    /** Total storage formatted (e.g., "2.15 GB"). */
    private String totalStorageSizeFormatted;

    /** Total span count across all services. */
    private long totalSpanCount;

    /** Total trace count across all services. */
    private long totalTraceCount;

    /** Number of trace indices in Elasticsearch. */
    private int indexCount;

    /** Cost per GB in USD (from rate card). */
    private double costPerGbUsd;

    /** Total estimated cost in USD. */
    private double totalCostUsd;

    /** Per-service span breakdown. */
    private List<ServiceSpanDetail> services;
}

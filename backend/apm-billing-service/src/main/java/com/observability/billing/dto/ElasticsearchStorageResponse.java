package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * US-BILL-001 — Elasticsearch storage usage response.
 * Contains total storage summary and per-index breakdown.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElasticsearchStorageResponse {

    /** Total storage size in bytes across all indices. */
    private long totalStorageSizeBytes;

    /** Total storage formatted (e.g., "15.72 GB"). */
    private String totalStorageSizeFormatted;

    /** Total document count across all indices. */
    private long totalDocumentCount;

    /** Total number of indices (excluding system indices). */
    private int indexCount;

    /** Cost per GB in USD (from rate card). */
    private double costPerGbUsd;

    /** Total estimated cost in USD. */
    private double totalCostUsd;

    /** Per-index storage breakdown. */
    private List<IndexStorageDetail> indices;
}

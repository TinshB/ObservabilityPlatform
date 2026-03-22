package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * US-BILL-001 — Per-index storage detail from Elasticsearch.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IndexStorageDetail {

    private String indexName;
    private long storageSizeBytes;
    private long documentCount;
    private int primaryShardCount;
    private int replicaShardCount;
    private int totalShardCount;

    /** Formatted storage size (e.g., "2.45 GB"). */
    private String storageSizeFormatted;

    /** Cost in USD for this index based on rate card. */
    private double costUsd;
}

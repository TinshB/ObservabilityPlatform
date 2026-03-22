package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * US-BILL-012 — A single month's cost data for the billing trend chart.
 * Contains per-category cost breakdown and the month total.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonthlyTrendDataPoint {

    /** Month label, e.g. "2026-01" */
    private String month;

    /** Display label, e.g. "Jan 2026" */
    private String monthLabel;

    /** Year */
    private int year;

    /** Month number (1-12) */
    private int monthNumber;

    /** Total storage cost (Elasticsearch + Prometheus + Jaeger) in USD */
    private double storageCostUsd;

    /** Total compute cost (CPU + Memory) in USD */
    private double computeCostUsd;

    /** Total licence cost in USD */
    private double licenceCostUsd;

    /** Grand total across all categories */
    private double totalCostUsd;
}

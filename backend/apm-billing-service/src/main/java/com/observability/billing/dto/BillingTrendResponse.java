package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * US-BILL-012 — Response DTO for billing trend data.
 * Contains monthly data points with per-category breakdowns and overall totals.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillingTrendResponse {

    /** Start of the queried date range (ISO date, e.g. "2026-01-01") */
    private String startDate;

    /** End of the queried date range (ISO date, e.g. "2026-03-22") */
    private String endDate;

    /** Number of months in the response */
    private int monthCount;

    /** Total cost across the entire date range */
    private double grandTotalCostUsd;

    /** Total storage cost across the entire date range */
    private double totalStorageCostUsd;

    /** Total compute cost across the entire date range */
    private double totalComputeCostUsd;

    /** Total licence cost across the entire date range */
    private double totalLicenceCostUsd;

    /** Monthly data points ordered chronologically */
    private List<MonthlyTrendDataPoint> months;
}

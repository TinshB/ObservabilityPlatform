package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * US-BILL-010 — Licence cost summary response.
 * Shows user count × tier cost breakdown by user type.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LicenceCostSummaryResponse {

    /** Total active users across all types. */
    private long totalUsers;

    /** Total monthly licence cost across all tiers. */
    private BigDecimal totalMonthlyCostUsd;

    /** Total annual projected cost. */
    private BigDecimal totalAnnualCostUsd;

    /** Per-tier breakdown. */
    private List<TierCostBreakdown> tiers;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TierCostBreakdown {
        /** Tier name (e.g., "Administrator"). */
        private String tierName;

        /** User type / role (e.g., "ADMIN"). */
        private String userType;

        /** Number of active users with this role. */
        private long userCount;

        /** Monthly cost per user for this tier. */
        private BigDecimal costPerUserUsd;

        /** Total monthly cost for this tier (userCount × costPerUser). */
        private BigDecimal totalMonthlyCostUsd;

        /** Whether this tier is active. */
        private boolean active;
    }
}

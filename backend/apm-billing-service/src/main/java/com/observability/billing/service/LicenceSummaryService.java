package com.observability.billing.service;

import com.observability.billing.client.UserServiceClient;
import com.observability.billing.dto.LicenceCostSummaryResponse;
import com.observability.billing.dto.LicenceCostSummaryResponse.TierCostBreakdown;
import com.observability.billing.entity.LicenceTierEntity;
import com.observability.billing.repository.LicenceTierRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * US-BILL-010 — Licence cost summary service.
 * Combines licence tier configuration with actual user counts
 * from the user-management-service to compute licence costs.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LicenceSummaryService {

    private final LicenceTierRepository licenceTierRepository;
    private final UserServiceClient userServiceClient;

    /**
     * Get licence cost summary with user counts per tier.
     * AC1: Table with user type, user count, cost per user, total cost.
     * AC2: Totals update automatically based on current user count.
     */
    @Transactional(readOnly = true)
    public LicenceCostSummaryResponse getSummary() {
        // Fetch all licence tiers
        List<LicenceTierEntity> allTiers = licenceTierRepository.findAllByOrderByTierNameAsc();

        // Fetch user counts by role from user-management-service
        Map<String, Long> userCountsByRole = fetchUserCounts();

        List<TierCostBreakdown> breakdowns = new ArrayList<>();
        BigDecimal totalMonthlyCost = BigDecimal.ZERO;
        long totalUsers = 0;

        for (LicenceTierEntity tier : allTiers) {
            long userCount = userCountsByRole.getOrDefault(tier.getUserType(), 0L);
            BigDecimal tierTotalCost = tier.getMonthlyCostUsd().multiply(BigDecimal.valueOf(userCount));

            breakdowns.add(TierCostBreakdown.builder()
                    .tierName(tier.getTierName())
                    .userType(tier.getUserType())
                    .userCount(userCount)
                    .costPerUserUsd(tier.getMonthlyCostUsd())
                    .totalMonthlyCostUsd(tierTotalCost)
                    .active(tier.isActive())
                    .build());

            if (tier.isActive()) {
                totalMonthlyCost = totalMonthlyCost.add(tierTotalCost);
                totalUsers += userCount;
            }
        }

        return LicenceCostSummaryResponse.builder()
                .totalUsers(totalUsers)
                .totalMonthlyCostUsd(totalMonthlyCost)
                .totalAnnualCostUsd(totalMonthlyCost.multiply(BigDecimal.valueOf(12)))
                .tiers(breakdowns)
                .build();
    }

    private Map<String, Long> fetchUserCounts() {
        try {
            return userServiceClient.getUserCountsByRole();
        } catch (Exception ex) {
            log.error("Failed to fetch user counts from user-management-service: {}", ex.getMessage());
            return Map.of();
        }
    }
}

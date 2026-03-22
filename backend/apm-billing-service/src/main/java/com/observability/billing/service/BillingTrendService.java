package com.observability.billing.service;

import com.observability.billing.dto.BillingTrendResponse;
import com.observability.billing.dto.MonthlyTrendDataPoint;
import com.observability.billing.repository.BillingSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Month;
import java.time.format.TextStyle;
import java.util.*;

/**
 * US-BILL-012 — Service for calculating monthly billing trends.
 * Aggregates daily billing snapshots into monthly totals by category.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BillingTrendService {

    private final BillingSnapshotRepository snapshotRepository;

    /**
     * Get monthly billing trend data for the given date range.
     * If no date range is specified, defaults to the full range available in the database.
     *
     * @param startDate start of range (inclusive), or null for earliest available
     * @param endDate   end of range (inclusive), or null for latest available
     * @return trend response with monthly data points
     */
    public BillingTrendResponse getMonthlyTrend(LocalDate startDate, LocalDate endDate) {
        // Default to full range if not specified
        if (startDate == null) {
            startDate = snapshotRepository.findEarliestSnapshotDate();
            if (startDate == null) {
                return emptyResponse();
            }
        }
        if (endDate == null) {
            endDate = snapshotRepository.findLatestSnapshotDate();
            if (endDate == null) {
                endDate = LocalDate.now();
            }
        }

        log.debug("Fetching billing trend: {} to {}", startDate, endDate);

        List<Object[]> rows = snapshotRepository.findMonthlyTotalsByCategory(startDate, endDate);

        // Build a map: "YYYY-MM" → category → cost
        Map<String, Map<String, Double>> monthCategoryMap = new LinkedHashMap<>();

        for (Object[] row : rows) {
            int year = ((Number) row[0]).intValue();
            int month = ((Number) row[1]).intValue();
            String category = (String) row[2];
            double cost = row[3] instanceof BigDecimal bd ? bd.doubleValue() : ((Number) row[3]).doubleValue();

            String key = String.format("%04d-%02d", year, month);
            monthCategoryMap.computeIfAbsent(key, k -> new HashMap<>())
                    .merge(category, cost, Double::sum);
        }

        // Convert to data points
        List<MonthlyTrendDataPoint> dataPoints = new ArrayList<>();
        double totalStorage = 0, totalCompute = 0, totalLicence = 0;

        for (Map.Entry<String, Map<String, Double>> entry : monthCategoryMap.entrySet()) {
            String key = entry.getKey();
            Map<String, Double> categories = entry.getValue();

            int year = Integer.parseInt(key.substring(0, 4));
            int month = Integer.parseInt(key.substring(5, 7));
            String monthLabel = Month.of(month).getDisplayName(TextStyle.SHORT, Locale.ENGLISH) + " " + year;

            double storage = roundCost(categories.getOrDefault("STORAGE", 0.0));
            double compute = roundCost(categories.getOrDefault("COMPUTE", 0.0));
            double licence = roundCost(categories.getOrDefault("LICENCE", 0.0));
            double total = roundCost(storage + compute + licence);

            totalStorage += storage;
            totalCompute += compute;
            totalLicence += licence;

            dataPoints.add(MonthlyTrendDataPoint.builder()
                    .month(key)
                    .monthLabel(monthLabel)
                    .year(year)
                    .monthNumber(month)
                    .storageCostUsd(storage)
                    .computeCostUsd(compute)
                    .licenceCostUsd(licence)
                    .totalCostUsd(total)
                    .build());
        }

        return BillingTrendResponse.builder()
                .startDate(startDate.toString())
                .endDate(endDate.toString())
                .monthCount(dataPoints.size())
                .grandTotalCostUsd(roundCost(totalStorage + totalCompute + totalLicence))
                .totalStorageCostUsd(roundCost(totalStorage))
                .totalComputeCostUsd(roundCost(totalCompute))
                .totalLicenceCostUsd(roundCost(totalLicence))
                .months(dataPoints)
                .build();
    }

    private BillingTrendResponse emptyResponse() {
        return BillingTrendResponse.builder()
                .startDate(null)
                .endDate(null)
                .monthCount(0)
                .grandTotalCostUsd(0)
                .totalStorageCostUsd(0)
                .totalComputeCostUsd(0)
                .totalLicenceCostUsd(0)
                .months(List.of())
                .build();
    }

    private static double roundCost(double cost) {
        return BigDecimal.valueOf(cost)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }
}

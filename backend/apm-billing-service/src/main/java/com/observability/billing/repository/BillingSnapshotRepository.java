package com.observability.billing.repository;

import com.observability.billing.entity.BillingSnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * US-BILL-012 — Repository for billing snapshot queries.
 * Supports monthly trend aggregation across cost categories.
 */
@Repository
public interface BillingSnapshotRepository extends JpaRepository<BillingSnapshotEntity, UUID> {

    /**
     * Aggregate daily snapshots into monthly totals grouped by category.
     * Returns rows of [year, month, category, totalCostUsd] ordered chronologically.
     */
    @Query("""
            SELECT EXTRACT(YEAR FROM s.snapshotDate)  AS yr,
                   EXTRACT(MONTH FROM s.snapshotDate) AS mo,
                   s.category,
                   SUM(s.costUsd)
              FROM BillingSnapshotEntity s
             WHERE s.snapshotDate >= :startDate
               AND s.snapshotDate <= :endDate
               AND s.serviceId IS NULL
             GROUP BY EXTRACT(YEAR FROM s.snapshotDate),
                      EXTRACT(MONTH FROM s.snapshotDate),
                      s.category
             ORDER BY yr, mo, s.category
            """)
    List<Object[]> findMonthlyTotalsByCategory(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * Get the earliest snapshot date in the dataset.
     */
    @Query("SELECT MIN(s.snapshotDate) FROM BillingSnapshotEntity s")
    LocalDate findEarliestSnapshotDate();

    /**
     * Get the latest snapshot date in the dataset.
     */
    @Query("SELECT MAX(s.snapshotDate) FROM BillingSnapshotEntity s")
    LocalDate findLatestSnapshotDate();
}

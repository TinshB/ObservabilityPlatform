package com.observability.billing.repository;

import com.observability.billing.entity.BillingRateCardEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * US-BILL-001 — Repository for billing rate card lookups.
 */
@Repository
public interface BillingRateCardRepository extends JpaRepository<BillingRateCardEntity, UUID> {

    /**
     * Find the currently active rate card for a given category and resource type.
     * Active means: effective_from <= now AND (effective_to IS NULL OR effective_to > now).
     */
    @Query("""
            SELECT r FROM BillingRateCardEntity r
            WHERE r.category = :category
              AND r.resourceType = :resourceType
              AND r.effectiveFrom <= :now
              AND (r.effectiveTo IS NULL OR r.effectiveTo > :now)
            ORDER BY r.effectiveFrom DESC
            LIMIT 1
            """)
    Optional<BillingRateCardEntity> findActiveRate(
            @Param("category") String category,
            @Param("resourceType") String resourceType,
            @Param("now") Instant now);
}

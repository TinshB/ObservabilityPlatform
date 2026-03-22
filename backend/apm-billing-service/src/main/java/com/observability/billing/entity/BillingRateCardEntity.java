package com.observability.billing.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * US-BILL-001 — Billing rate card entity.
 * Stores cost-per-unit rates for storage, compute, and licence categories.
 */
@Entity
@Table(name = "billing_rate_cards")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillingRateCardEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    /** Category: STORAGE, COMPUTE, LICENCE */
    @Column(name = "category", nullable = false, length = 20)
    private String category;

    /** Resource type identifier, e.g. "elasticsearch_gb", "cpu_core_hour", "memory_gb_hour" */
    @Column(name = "resource_type", nullable = false, length = 50)
    private String resourceType;

    /** Cost per unit in USD */
    @Column(name = "unit_cost_usd", nullable = false, precision = 10, scale = 4)
    private BigDecimal unitCostUsd;

    /** When this rate becomes effective */
    @Column(name = "effective_from", nullable = false)
    private Instant effectiveFrom;

    /** When this rate expires (null = currently active) */
    @Column(name = "effective_to")
    private Instant effectiveTo;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}

package com.observability.billing.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * US-BILL-012 — Daily billing snapshot entity.
 * Stores daily cost rollups for trend analysis across Storage, Compute, and Licence categories.
 */
@Entity
@Table(name = "billing_snapshots")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillingSnapshotEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    /** Category: STORAGE, COMPUTE, LICENCE */
    @Column(name = "category", nullable = false, length = 20)
    private String category;

    /** Resource type identifier, e.g. "elasticsearch_gb", "cpu_core_hour", "licence_users" */
    @Column(name = "resource_type", nullable = false, length = 50)
    private String resourceType;

    /** Signal type: LOG, TRACE, METRIC (nullable for non-signal categories) */
    @Column(name = "signal_type", length = 10)
    private String signalType;

    /** Optional service reference for per-service breakdowns */
    @Column(name = "service_id")
    private UUID serviceId;

    /** Quantity in category-specific units (GB, core-hours, user count, etc.) */
    @Column(name = "quantity", nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    /** Cost in USD */
    @Column(name = "cost_usd", nullable = false, precision = 10, scale = 4)
    private BigDecimal costUsd;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }
}

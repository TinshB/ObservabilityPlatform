package com.observability.billing.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * US-BILL-009 — Licence tier entity.
 * Stores fixed monthly cost per user type for licence billing.
 */
@Entity
@Table(name = "licence_tiers")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LicenceTierEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "tier_name", nullable = false, length = 50)
    private String tierName;

    @Column(name = "user_type", nullable = false, length = 30)
    private String userType;

    @Column(name = "monthly_cost_usd", nullable = false, precision = 10, scale = 2)
    private BigDecimal monthlyCostUsd;

    @Builder.Default
    @Column(name = "is_active", nullable = false)
    private boolean active = true;

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

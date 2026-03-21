package com.observability.apm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 10.2 — Alert entity.
 * Represents an alert instance created by the Alert Engine when an SLA rule breaches.
 * Follows the state machine: OK → PENDING → FIRING → RESOLVED.
 */
@Entity
@Table(name = "alerts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "sla_rule_id", nullable = false)
    private UUID slaRuleId;

    @Column(name = "service_id", nullable = false)
    private UUID serviceId;

    /** OK, PENDING, FIRING, RESOLVED */
    @Builder.Default
    @Column(name = "state", nullable = false, length = 20)
    private String state = "OK";

    @Column(name = "severity", nullable = false, length = 20)
    private String severity;

    @Column(name = "message", length = 2000)
    private String message;

    @Column(name = "evaluated_value")
    private Double evaluatedValue;

    /** How many consecutive evaluation cycles the threshold was breached */
    @Builder.Default
    @Column(name = "pending_count", nullable = false)
    private int pendingCount = 0;

    @Column(name = "fired_at")
    private Instant firedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    @Column(name = "acknowledged_by")
    private String acknowledgedBy;

    /** Story 11.2: When the last notification was sent for this alert (for suppression). */
    @Column(name = "last_notified_at")
    private Instant lastNotifiedAt;

    /** Story 11.2: How many notifications have been dispatched for this alert. */
    @Builder.Default
    @Column(name = "notification_count", nullable = false)
    private int notificationCount = 0;

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

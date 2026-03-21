package com.observability.apm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Story 10.1 — SLA rule entity.
 * Defines a threshold condition the Alert Engine evaluates on a schedule.
 */
@Entity
@Table(name = "sla_rules")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlaRuleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "service_id", nullable = false)
    private UUID serviceId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", length = 1000)
    private String description;

    /** METRICS or LOGS */
    @Column(name = "signal_type", nullable = false, length = 20)
    private String signalType;

    /** PromQL metric name / expression fragment (for METRICS rules) */
    @Column(name = "metric_name", length = 500)
    private String metricName;

    /** Severity level or keyword (for LOGS rules) */
    @Column(name = "log_condition", length = 500)
    private String logCondition;

    /** GT, GTE, LT, LTE, EQ, NEQ */
    @Column(name = "operator", nullable = false, length = 10)
    private String operator;

    @Column(name = "threshold", nullable = false)
    private double threshold;

    /** e.g. "5m", "15m", "1h" */
    @Builder.Default
    @Column(name = "evaluation_window", nullable = false, length = 20)
    private String evaluationWindow = "5m";

    /** How many consecutive breaches before PENDING → FIRING */
    @Builder.Default
    @Column(name = "pending_periods", nullable = false)
    private int pendingPeriods = 1;

    /** CRITICAL, WARNING, INFO */
    @Builder.Default
    @Column(name = "severity", nullable = false, length = 20)
    private String severity = "WARNING";

    @Builder.Default
    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    /** Story 11.2: Group key for alert grouping (e.g. "service", "service+severity") */
    @Builder.Default
    @Column(name = "group_key", nullable = false, length = 100)
    private String groupKey = "service";

    /** Story 11.2: Suppression window — suppress duplicate notifications for this duration (e.g. "15m") */
    @Builder.Default
    @Column(name = "suppression_window", nullable = false, length = 20)
    private String suppressionWindow = "15m";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "sla_rule_channels",
            joinColumns = @JoinColumn(name = "sla_rule_id"),
            inverseJoinColumns = @JoinColumn(name = "channel_id")
    )
    private Set<AlertChannelEntity> channels = new HashSet<>();

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

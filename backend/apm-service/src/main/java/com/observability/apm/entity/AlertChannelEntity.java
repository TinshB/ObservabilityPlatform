package com.observability.apm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 10.6 — Notification channel entity.
 * Stores configuration for EMAIL, SMS, or MS_TEAMS notification targets.
 */
@Entity
@Table(name = "alert_channels")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertChannelEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "name", nullable = false)
    private String name;

    /** EMAIL, SMS, MS_TEAMS */
    @Column(name = "channel_type", nullable = false, length = 20)
    private String channelType;

    /** JSONB config — channel-specific details */
    @Column(name = "config", columnDefinition = "jsonb", nullable = false)
    private String config;

    @Builder.Default
    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

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

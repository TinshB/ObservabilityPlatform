package com.observability.apm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 11.3 — Service dependency entity.
 * Represents a dependency edge from a source service to a target (service, database, or cloud component).
 */
@Entity
@Table(name = "dependencies",
       uniqueConstraints = @UniqueConstraint(columnNames = {"source_service_id", "target_service_name", "dependency_type"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DependencyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "source_service_id", nullable = false)
    private UUID sourceServiceId;

    @Column(name = "target_service_name", nullable = false)
    private String targetServiceName;

    /** HTTP, GRPC, DATABASE, CLOUD */
    @Column(name = "dependency_type", nullable = false, length = 50)
    private String dependencyType;

    /** Only set for DATABASE dependencies (e.g. postgresql, mysql, redis). */
    @Column(name = "db_system", length = 100)
    private String dbSystem;

    /** SERVICE, DATABASE, CLOUD_COMPONENT */
    @Column(name = "target_type", nullable = false, length = 50)
    private String targetType;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Builder.Default
    @Column(name = "call_count_1h", nullable = false)
    private long callCount1h = 0;

    @Builder.Default
    @Column(name = "error_count_1h", nullable = false)
    private long errorCount1h = 0;

    @Builder.Default
    @Column(name = "avg_latency_ms_1h", nullable = false)
    private double avgLatencyMs1h = 0;

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
        if (this.lastSeenAt == null) this.lastSeenAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}

package com.observability.apm.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 12.3 — Workflow instance step entity.
 * Records which span matched which workflow step within an instance.
 */
@Entity
@Table(name = "workflow_instance_steps")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowInstanceStepEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "instance_id", nullable = false)
    private UUID instanceId;

    @Column(name = "step_id", nullable = false)
    private UUID stepId;

    @Column(name = "span_id", nullable = false, length = 64)
    private String spanId;

    @Column(name = "service_name", nullable = false)
    private String serviceName;

    @Column(name = "operation_name", length = 500)
    private String operationName;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Builder.Default
    @Column(name = "error", nullable = false)
    private boolean error = false;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = Instant.now();
    }
}

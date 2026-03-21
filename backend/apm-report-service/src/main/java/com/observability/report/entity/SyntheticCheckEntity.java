package com.observability.report.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "synthetic_checks")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyntheticCheckEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "service_id")
    private UUID serviceId;

    @Column(name = "service_name", length = 255)
    private String serviceName;

    @Column(nullable = false, length = 2048)
    private String url;

    @Column(name = "http_method", nullable = false, length = 10)
    private String httpMethod;

    @Column(name = "request_headers", length = 4000)
    private String requestHeaders;

    @Column(name = "request_body", length = 4000)
    private String requestBody;

    @Column(name = "schedule_cron", nullable = false, length = 100)
    private String scheduleCron;

    @Column(name = "timeout_ms", nullable = false)
    private int timeoutMs;

    @Column(name = "expected_status_code")
    private Integer expectedStatusCode;

    @Column(name = "expected_body_contains", length = 1000)
    private String expectedBodyContains;

    @Column(name = "max_latency_ms")
    private Integer maxLatencyMs;

    @Column(name = "sla_rule_id")
    private UUID slaRuleId;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_by", nullable = false, length = 255)
    private String createdBy;

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

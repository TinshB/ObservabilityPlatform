package com.observability.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "flow_pattern_steps",
       uniqueConstraints = @UniqueConstraint(columnNames = {"pattern_id", "step_order"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FlowPatternStepEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pattern_id", nullable = false)
    private FlowPatternEntity pattern;

    @Column(name = "step_order", nullable = false)
    private int stepOrder;

    @Column(name = "service_name", nullable = false, length = 255)
    private String serviceName;

    @Column(name = "service_type", nullable = false, length = 50)
    private String serviceType;

    @Column(name = "http_method", length = 10)
    private String httpMethod;

    @Column(name = "path_pattern", length = 500)
    private String pathPattern;

    @Column(name = "avg_latency_ms")
    private Double avgLatencyMs;

    @Column(name = "error_rate")
    @Builder.Default
    private double errorRate = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}

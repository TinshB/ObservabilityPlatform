package com.observability.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "flow_pattern_edges")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FlowPatternEdgeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pattern_id", nullable = false)
    private FlowPatternEntity pattern;

    @Column(name = "source_service", nullable = false, length = 255)
    private String sourceService;

    @Column(name = "target_service", nullable = false, length = 255)
    private String targetService;

    @Column(name = "call_count", nullable = false)
    @Builder.Default
    private int callCount = 0;

    @Column(name = "avg_latency_ms")
    private Double avgLatencyMs;

    @Column(name = "error_rate")
    @Builder.Default
    private double errorRate = 0;

    @Column(name = "http_method", length = 20)
    private String httpMethod;

    @Column(name = "http_path", length = 500)
    private String httpPath;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}

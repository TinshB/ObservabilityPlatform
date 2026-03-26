package com.observability.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "flow_patterns")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FlowPatternEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_id", nullable = false)
    private FlowAnalysisEntity analysis;

    @Column(length = 255)
    private String name;

    @Column(nullable = false)
    @Builder.Default
    private int frequency = 0;

    @Column(name = "avg_latency_ms")
    private Double avgLatencyMs;

    @Column(name = "p50_latency_ms")
    private Double p50LatencyMs;

    @Column(name = "p95_latency_ms")
    private Double p95LatencyMs;

    @Column(name = "p99_latency_ms")
    private Double p99LatencyMs;

    @Column(name = "error_rate")
    @Builder.Default
    private double errorRate = 0;

    @Column(name = "sample_trace_ids", columnDefinition = "TEXT")
    private String sampleTraceIds;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @OneToMany(mappedBy = "pattern", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("stepOrder ASC")
    @Builder.Default
    private List<FlowPatternStepEntity> steps = new ArrayList<>();

    @OneToMany(mappedBy = "pattern", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<FlowPatternEdgeEntity> edges = new ArrayList<>();
}

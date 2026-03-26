package com.observability.ai.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "flow_analyses")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FlowAnalysisEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "IN_PROGRESS";

    @Column(name = "service_ids", nullable = false, columnDefinition = "TEXT")
    private String serviceIds;

    @Column(name = "service_names", columnDefinition = "TEXT")
    private String serviceNames;

    @Column(name = "time_range_start", nullable = false)
    private OffsetDateTime timeRangeStart;

    @Column(name = "time_range_end", nullable = false)
    private OffsetDateTime timeRangeEnd;

    @Column(name = "operation_filter", length = 500)
    private String operationFilter;

    @Column(name = "trace_sample_limit", nullable = false)
    @Builder.Default
    private int traceSampleLimit = 1000;

    @Column(name = "traces_analyzed")
    private Integer tracesAnalyzed;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @OneToMany(mappedBy = "analysis", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<FlowPatternEntity> patterns = new ArrayList<>();

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}

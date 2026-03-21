package com.observability.report.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "synthetic_results")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyntheticResultEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "check_id", nullable = false)
    private UUID checkId;

    @Column(name = "check_name", length = 255)
    private String checkName;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "latency_ms")
    private Long latencyMs;

    @Column(nullable = false)
    private boolean success;

    @Column(name = "status_code_match")
    private Boolean statusCodeMatch;

    @Column(name = "body_match")
    private Boolean bodyMatch;

    @Column(name = "latency_match")
    private Boolean latencyMatch;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @Column(name = "response_body_snippet", length = 2000)
    private String responseBodySnippet;

    @Column(name = "executed_at", nullable = false)
    private Instant executedAt;

    @PrePersist
    protected void onPersist() {
        if (this.executedAt == null) {
            this.executedAt = Instant.now();
        }
    }
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 11.3 — Response DTO for a single service dependency.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DependencyResponse {

    private UUID id;
    private UUID sourceServiceId;
    private String sourceServiceName;
    private String targetServiceName;
    private String dependencyType;   // HTTP, GRPC, DATABASE, CLOUD
    private String dbSystem;         // only for DATABASE type
    private String targetType;       // SERVICE, DATABASE, CLOUD_COMPONENT
    private String displayName;
    private Instant lastSeenAt;
    private long callCount1h;
    private long errorCount1h;
    private double avgLatencyMs1h;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;
}

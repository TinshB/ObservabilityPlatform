package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceResponse {

    private UUID id;
    private String name;
    private String description;
    private String ownerTeam;
    private String environment;
    private String tier;
    private boolean metricsEnabled;
    private boolean logsEnabled;
    private boolean tracesEnabled;
    private boolean active;
    private String registrationSource;
    private Instant createdAt;
    private Instant updatedAt;
}

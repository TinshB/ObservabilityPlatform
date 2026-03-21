package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 10.2 — Alert response DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertResponse {

    private UUID id;
    private UUID slaRuleId;
    private String slaRuleName;
    private UUID serviceId;
    private String serviceName;
    private String state;
    private String severity;
    private String message;
    private Double evaluatedValue;
    private Instant firedAt;
    private Instant resolvedAt;
    private Instant acknowledgedAt;
    private String acknowledgedBy;
    private Instant createdAt;
    private Instant updatedAt;
}

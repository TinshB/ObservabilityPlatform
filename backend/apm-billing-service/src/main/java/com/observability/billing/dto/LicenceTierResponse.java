package com.observability.billing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * US-BILL-009 — Licence tier response DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LicenceTierResponse {

    private UUID id;
    private String tierName;
    private String userType;
    private BigDecimal monthlyCostUsd;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;
}

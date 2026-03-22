package com.observability.billing.dto;

import jakarta.validation.constraints.DecimalMin;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * US-BILL-009 — Request to update an existing licence tier.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateLicenceTierRequest {

    private String tierName;

    private String userType;

    @DecimalMin(value = "0.00", message = "Monthly cost must be non-negative")
    private BigDecimal monthlyCostUsd;

    private Boolean active;
}

package com.observability.billing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * US-BILL-009 — Request to create a new licence tier.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateLicenceTierRequest {

    @NotBlank(message = "Tier name is required")
    private String tierName;

    @NotBlank(message = "User type is required")
    private String userType;

    @NotNull(message = "Monthly cost is required")
    @DecimalMin(value = "0.00", message = "Monthly cost must be non-negative")
    private BigDecimal monthlyCostUsd;
}

package com.observability.billing.controller;

import com.observability.billing.dto.BillingTrendResponse;
import com.observability.billing.service.BillingTrendService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * US-BILL-012 — Billing trend REST controller.
 * Provides monthly billing trend data for cost analysis over time.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Billing — Trends", description = "Billing trend analytics and monthly cost tracking")
public class BillingTrendController {

    private final BillingTrendService billingTrendService;

    /**
     * US-BILL-012: Get monthly billing trend data.
     * Returns monthly totals broken down by Storage, Compute, and Licensing.
     * Supports optional date range filtering.
     *
     * @param startDate optional start date (inclusive), defaults to earliest available data
     * @param endDate   optional end date (inclusive), defaults to latest available data
     * @return trend response with monthly data points
     */
    @GetMapping("/api/v1/billing/trends")
    @Operation(summary = "Get monthly billing trend data with category breakdown")
    public ResponseEntity<ApiResponse<BillingTrendResponse>> getBillingTrend(
            @Parameter(description = "Start date (ISO format, e.g. 2026-01-01)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @Parameter(description = "End date (ISO format, e.g. 2026-03-31)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        BillingTrendResponse result = billingTrendService.getMonthlyTrend(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload to enable/disable individual signals (metrics, logs, traces) for a service.
 * Fields set to {@code null} are left unchanged.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SignalToggleRequest {

    private Boolean metricsEnabled;
    private Boolean logsEnabled;
    private Boolean tracesEnabled;
}

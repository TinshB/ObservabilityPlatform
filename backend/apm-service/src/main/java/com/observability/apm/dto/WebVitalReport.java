package com.observability.apm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Payload sent by the browser OTel SDK to report a single Core Web Vital measurement.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebVitalReport {

    /** Service name (matches the job label in Prometheus). */
    @NotBlank
    private String serviceName;

    /** Metric name: LCP, FCP, CLS, INP, TTFB. */
    @NotBlank
    private String name;

    /** Measured value (milliseconds for timing metrics, unitless for CLS). */
    @NotNull
    private Double value;

    /** Rating from web-vitals library: good, needs-improvement, poor. */
    private String rating;

    /** Navigation type: navigate, reload, back-forward, etc. */
    private String navigationType;
}

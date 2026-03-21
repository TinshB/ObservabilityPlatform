package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 6.1 — UI-level (Web Vitals) metrics response.
 * Contains FCP, LCP, CLS, and TTI percentile time-series and
 * current P75 values with Google Core Web Vitals threshold status.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UiMetricsResponse {

    private String serviceName;

    // ── First Contentful Paint ────────────────────────────────────────────────

    /** FCP P50 time-series (seconds). */
    private TimeSeries fcpP50;

    /** FCP P75 time-series (seconds). */
    private TimeSeries fcpP75;

    /** FCP P95 time-series (seconds). */
    private TimeSeries fcpP95;

    // ── Largest Contentful Paint ──────────────────────────────────────────────

    /** LCP P50 time-series (seconds). */
    private TimeSeries lcpP50;

    /** LCP P75 time-series (seconds). */
    private TimeSeries lcpP75;

    /** LCP P95 time-series (seconds). */
    private TimeSeries lcpP95;

    // ── Cumulative Layout Shift ──────────────────────────────────────────────

    /** CLS P50 time-series (unitless score). */
    private TimeSeries clsP50;

    /** CLS P75 time-series (unitless score). */
    private TimeSeries clsP75;

    /** CLS P95 time-series (unitless score). */
    private TimeSeries clsP95;

    // ── Time to Interactive ──────────────────────────────────────────────────

    /** TTI P50 time-series (seconds). */
    private TimeSeries ttiP50;

    /** TTI P75 time-series (seconds). */
    private TimeSeries ttiP75;

    /** TTI P95 time-series (seconds). */
    private TimeSeries ttiP95;

    // ── Current instant P75 values ───────────────────────────────────────────

    private InstantWebVitals current;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InstantWebVitals {
        /** FCP P75 value in seconds. */
        private Double fcpP75;

        /** LCP P75 value in seconds. */
        private Double lcpP75;

        /** CLS P75 value (unitless). */
        private Double clsP75;

        /** TTI P75 value in seconds. */
        private Double ttiP75;

        /** FCP status: "good", "needs-improvement", or "poor". */
        private String fcpStatus;

        /** LCP status: "good", "needs-improvement", or "poor". */
        private String lcpStatus;

        /** CLS status: "good", "needs-improvement", or "poor". */
        private String clsStatus;

        /** TTI status: "good", "needs-improvement", or "poor". */
        private String ttiStatus;
    }
}

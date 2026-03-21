package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 6.3 — Log-level metrics response.
 * Contains log volume per severity, error log ratio, and top log patterns.
 * Volume/ratio time-series from Prometheus; pattern analysis from Elasticsearch.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogMetricsResponse {

    private String serviceName;

    // ── Log volume time-series ───────────────────────────────────────────────

    /** Log volume (records/sec) per severity level (DEBUG, INFO, WARN, ERROR, FATAL). */
    private List<TimeSeries> volumeByLevel;

    /** Total log volume (records/sec) over time. */
    private TimeSeries totalVolume;

    /** Error log ratio (ERROR+FATAL / total) over time [0.0–1.0]. */
    private TimeSeries errorRatio;

    // ── Pattern analysis ─────────────────────────────────────────────────────

    /** Top log patterns by frequency, from Elasticsearch aggregation. */
    private List<LogPattern> topPatterns;

    // ── Current instant values ───────────────────────────────────────────────

    private InstantLogMetrics current;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LogPattern {
        /** Representative log message pattern / fingerprint. */
        private String pattern;

        /** Predominant severity level for this pattern. */
        private String level;

        /** Total occurrence count in the window. */
        private long count;

        /** Percentage of total logs this pattern represents. */
        private double percentage;

        /** Trend indicator: "up", "down", or "stable". */
        private String trend;

        /** Time series of occurrence count per interval for trend visualization. */
        private List<MetricDataPoint> trendSeries;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InstantLogMetrics {
        /** Current total log volume (records/sec). */
        private Double totalVolume;

        /** Current error log volume (records/sec). */
        private Double errorVolume;

        /** Current error ratio (ERROR+FATAL / total). */
        private Double errorRatio;

        /** Number of distinct log patterns. */
        private Integer distinctPatterns;
    }
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 8.2 — Unified Service Deep Dive response.
 * Aggregates health score, key metrics, recent traces with errors,
 * log volume, and enrichment quality for a single service.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceDeepDiveResponse {

    /** Service identity. */
    private String serviceId;
    private String serviceName;
    private String environment;
    private String ownerTeam;
    private String tier;

    /** Signal toggle status. */
    private boolean metricsEnabled;
    private boolean logsEnabled;
    private boolean tracesEnabled;

    /** Overall health score (0.0–1.0). */
    private double healthScore;

    /** Health verdict: healthy, degraded, or unhealthy. */
    private String healthStatus;

    /** Key real-time metrics snapshot. */
    private KeyMetrics keyMetrics;

    /** Recent error traces summary. */
    private List<ErrorTraceSummary> recentErrors;

    /** Log volume summary. */
    private LogSummary logSummary;

    /** Trace activity summary. */
    private TraceSummary traceSummary;

    // ── Nested DTOs ─────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyMetrics {

        /** Current P50 latency in seconds (null if unavailable). */
        private Double latencyP50;

        /** Current P95 latency in seconds. */
        private Double latencyP95;

        /** Current P99 latency in seconds. */
        private Double latencyP99;

        /** Current error rate (0.0–1.0). */
        private Double errorRate;

        /** Current requests per second. */
        private Double requestRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ErrorTraceSummary {

        /** Trace ID. */
        private String traceId;

        /** Root operation. */
        private String rootOperation;

        /** Trace start time (ISO-8601). */
        private String startTime;

        /** Duration in microseconds. */
        private long durationMicros;

        /** Number of error spans. */
        private int errorCount;

        /** Total span count. */
        private int spanCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LogSummary {

        /** Total log volume in the time range. */
        private long totalLogs;

        /** Error-level log count. */
        private long errorLogs;

        /** Error-to-total ratio (0.0–1.0). */
        private Double errorRatio;

        /** Log enrichment health score (0.0–1.0). */
        private Double enrichmentScore;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TraceSummary {

        /** Number of traces found in the time range. */
        private int traceCount;

        /** Number of traces with errors. */
        private int errorTraceCount;

        /** Average trace duration in microseconds. */
        private long avgDurationMicros;
    }
}

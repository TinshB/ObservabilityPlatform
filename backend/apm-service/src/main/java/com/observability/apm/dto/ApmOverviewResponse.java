package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Story 8.3 — Platform-wide APM overview response.
 * Provides service health summary, top unhealthy services, and signal volume stats.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApmOverviewResponse {

    /** Total number of active registered services. */
    private int totalServices;

    /** Count of services by health status: healthy / degraded / unhealthy / unknown. */
    private Map<String, Integer> healthDistribution;

    /** Global signal enablement counts. */
    private SignalCounts signalCounts;

    /** Top N unhealthy services, ordered by health score ascending (worst first). */
    private List<ServiceHealthSummary> topUnhealthy;

    /** All service health summaries, ordered by health score ascending. */
    private List<ServiceHealthSummary> services;

    // ── Nested DTOs ─────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SignalCounts {

        /** Number of services with metrics enabled. */
        private int metricsEnabled;

        /** Number of services with logs enabled. */
        private int logsEnabled;

        /** Number of services with traces enabled. */
        private int tracesEnabled;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceHealthSummary {

        /** Service UUID. */
        private String serviceId;

        /** Service name. */
        private String serviceName;

        /** Environment (dev / staging / production). */
        private String environment;

        /** Owner team. */
        private String ownerTeam;

        /** Service tier. */
        private String tier;

        /** Composite health score (0.0–1.0). */
        private double healthScore;

        /** Health verdict: healthy, degraded, unhealthy, unknown. */
        private String healthStatus;

        /** Current P95 latency in seconds (null if unavailable). */
        private Double latencyP95;

        /** Current error rate (0.0–1.0, null if unavailable). */
        private Double errorRate;

        /** Current requests per second (null if unavailable). */
        private Double requestRate;
    }
}

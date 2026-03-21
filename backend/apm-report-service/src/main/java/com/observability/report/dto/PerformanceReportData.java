package com.observability.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PerformanceReportData {

    private String reportName;
    private Instant generatedAt;
    private Instant timeRangeStart;
    private Instant timeRangeEnd;
    private String serviceName;

    private LatencySummary latencySummary;
    private ThroughputSummary throughputSummary;
    private ErrorBudgetSummary errorBudgetSummary;
    private InfraUtilisation infraUtilisation;

    private List<LatencyTrend> latencyTrends;
    private List<ThroughputTrend> throughputTrends;
    private List<TopSlowEndpoint> topSlowEndpoints;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LatencySummary {
        private double p50Ms;
        private double p95Ms;
        private double p99Ms;
        private double avgMs;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ThroughputSummary {
        private double avgRequestsPerSecond;
        private double peakRequestsPerSecond;
        private long totalRequests;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ErrorBudgetSummary {
        private double errorRatePct;
        private double errorBudgetRemainingPct;
        private long totalErrors;
        private long totalRequests;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InfraUtilisation {
        private double avgCpuPct;
        private double peakCpuPct;
        private double avgMemoryPct;
        private double peakMemoryPct;
        private double avgDiskIoPct;
        private double avgNetworkMbps;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LatencyTrend {
        private String timestamp;
        private double p50Ms;
        private double p95Ms;
        private double p99Ms;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ThroughputTrend {
        private String timestamp;
        private double requestsPerSecond;
        private double errorRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopSlowEndpoint {
        private String method;
        private String path;
        private double avgLatencyMs;
        private double p99LatencyMs;
        private long callCount;
    }
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 6.2 — Query-level metrics response.
 * Contains per-operation SQL execution time, call counts, and slow-query flags
 * sourced from OTel JDBC instrumentation metrics in Prometheus.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QueryMetricsResponse {

    private String serviceName;

    /** Per-operation summary (e.g. SELECT users, INSERT orders). */
    private List<QuerySummary> queries;

    /** Overall DB operation latency P50 over time. */
    private TimeSeries avgLatency;

    /** Overall DB operation latency P95 over time. */
    private TimeSeries p95Latency;

    /** Overall DB query rate (queries/sec) over time. */
    private TimeSeries queryRate;

    /** Per-operation latency time-series for detail charts. */
    private List<TimeSeries> latencyByOperation;

    /** Current instant values. */
    private InstantQueryMetrics current;

    /** PromQL queries executed for transparency / debugging. */
    private List<String> executedQueries;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuerySummary {
        /** DB operation type (SELECT, INSERT, UPDATE, DELETE). */
        private String operation;

        /** Target table / collection in format db.table (e.g. mydb.users). */
        private String collection;

        /** Database name (db.name). */
        private String dbName;

        /** SQL statement or query text (db.statement). */
        private String statement;

        /** Average execution time in seconds. */
        private Double avgExecTime;

        /** P95 execution time in seconds. */
        private Double p95ExecTime;

        /** Total call count in the selected window. */
        private Double callCount;

        /** Whether P95 exceeds the slow-query threshold. */
        private boolean slowQuery;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InstantQueryMetrics {
        /** Overall average latency in seconds. */
        private Double avgLatency;

        /** Overall P95 latency in seconds. */
        private Double p95Latency;

        /** Current query rate (queries/sec). */
        private Double queryRate;

        /** Number of operation types flagged as slow. */
        private Integer slowQueryCount;
    }
}

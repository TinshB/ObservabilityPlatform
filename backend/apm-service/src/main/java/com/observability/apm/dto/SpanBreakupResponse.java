package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 8.1 — Span-level breakup of a distributed trace.
 * Decomposes a trace into per-operation summaries with durations, counts, and error statuses.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SpanBreakupResponse {

    /** Distributed trace ID. */
    private String traceId;

    /** Total trace duration in microseconds. */
    private long traceDurationMicros;

    /** Total number of spans in the trace. */
    private int totalSpans;

    /** Number of distinct services. */
    private int serviceCount;

    /** Per-operation span breakup entries, ordered by total duration descending. */
    private List<OperationBreakup> operations;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OperationBreakup {

        /** Operation name (e.g. "GET /api/v1/users"). */
        private String operationName;

        /** Service name that owns this operation. */
        private String serviceName;

        /** Number of spans with this operation in the trace. */
        private int spanCount;

        /** Number of error spans for this operation. */
        private int errorCount;

        /** Total duration across all spans of this operation (µs). */
        private long totalDurationMicros;

        /**
         * Self-time: time spent exclusively in this operation's spans,
         * excluding child span durations (µs).
         */
        private long selfTimeMicros;

        /** Average span duration for this operation (µs). */
        private long avgDurationMicros;

        /** Maximum span duration for this operation (µs). */
        private long maxDurationMicros;

        /** Minimum span duration for this operation (µs). */
        private long minDurationMicros;

        /** Percentage of trace duration consumed by this operation's total time. */
        private double percentOfTrace;
    }
}

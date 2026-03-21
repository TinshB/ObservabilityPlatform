package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 7.2 — Paginated trace search response for the React Trace Viewer.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TraceSearchResponse {

    /** Trace summaries matching the search filters. */
    private List<TraceSummary> traces;

    /** Total number of results (may be estimated by Jaeger). */
    private int total;

    /** Maximum results requested. */
    private int limit;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TraceSummary {

        /** Distributed trace ID. */
        private String traceId;

        /** Service name of the root span. */
        private String rootService;

        /** Operation name of the root span. */
        private String rootOperation;

        /** Trace start time (ISO-8601). */
        private String startTime;

        /** Total trace duration in microseconds. */
        private long durationMicros;

        /** Number of spans in the trace. */
        private int spanCount;

        /** Number of spans with error status. */
        private int errorCount;

        /** Distinct service names participating in the trace. */
        private List<String> services;
    }
}

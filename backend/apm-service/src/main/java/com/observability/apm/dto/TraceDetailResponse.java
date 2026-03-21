package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Story 7.2 — Full trace detail with spans for the waterfall view.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TraceDetailResponse {

    /** Distributed trace ID. */
    private String traceId;

    /** Total trace duration in microseconds. */
    private long durationMicros;

    /** Trace start time (ISO-8601). */
    private String startTime;

    /** Total number of spans. */
    private int spanCount;

    /** Number of error spans. */
    private int errorCount;

    /** Distinct service names. */
    private List<String> services;

    /** All spans in the trace. */
    private List<SpanDetail> spans;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpanDetail {

        /** Span ID. */
        private String spanId;

        /** Parent span ID (null for root span). */
        private String parentSpanId;

        /** Operation name. */
        private String operationName;

        /** Service name that emitted this span. */
        private String serviceName;

        /** Span start time in microseconds since epoch. */
        private long startTime;

        /** Span duration in microseconds. */
        private long durationMicros;

        /** Whether this span has an error status. */
        private boolean hasError;

        /** HTTP status code (if applicable). */
        private Integer httpStatusCode;

        /** HTTP method (if applicable). */
        private String httpMethod;

        /** HTTP URL (if applicable). */
        private String httpUrl;

        /** Span tags as key-value pairs. */
        private Map<String, String> tags;

        /** Span log entries. */
        private List<SpanLog> logs;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SpanLog {

        /** Log timestamp in microseconds since epoch. */
        private long timestamp;

        /** Log fields as key-value pairs. */
        private Map<String, String> fields;
    }
}

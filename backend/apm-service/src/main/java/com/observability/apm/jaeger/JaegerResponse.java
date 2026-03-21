package com.observability.apm.jaeger;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Story 7.2 — Maps the Jaeger Query API response format.
 *
 * <pre>
 * GET /api/traces?service=...
 * {
 *   "data": [
 *     {
 *       "traceID": "abc123",
 *       "spans": [ { ... } ],
 *       "processes": { "p1": { "serviceName": "svc", "tags": [...] } }
 *     }
 *   ],
 *   "total": 0,
 *   "limit": 0,
 *   "offset": 0,
 *   "errors": null
 * }
 * </pre>
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class JaegerResponse {

    private List<JaegerTrace> data;
    private int total;
    private int limit;
    private int offset;
    private List<JaegerError> errors;

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerTrace {
        @JsonProperty("traceID")
        private String traceId;
        private List<JaegerSpan> spans;
        private Map<String, JaegerProcess> processes;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerSpan {
        @JsonProperty("traceID")
        private String traceId;

        @JsonProperty("spanID")
        private String spanId;

        @JsonProperty("operationName")
        private String operationName;

        /** References to parent/child spans. */
        private List<JaegerReference> references;

        /** Start time in microseconds since epoch. */
        private long startTime;

        /** Duration in microseconds. */
        private long duration;

        /** Span tags (key-value pairs). */
        private List<JaegerTag> tags;

        /** Span logs. */
        private List<JaegerLog> logs;

        /** Process ID — key into the parent trace's processes map. */
        @JsonProperty("processID")
        private String processId;

        /** Warnings associated with this span. */
        private List<String> warnings;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerReference {
        @JsonProperty("refType")
        private String refType; // "CHILD_OF" or "FOLLOWS_FROM"

        @JsonProperty("traceID")
        private String traceId;

        @JsonProperty("spanID")
        private String spanId;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerTag {
        private String key;
        private String type; // "string", "bool", "int64", "float64", "binary"
        private Object value;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerLog {
        private long timestamp; // microseconds
        private List<JaegerTag> fields;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerProcess {
        private String serviceName;
        private List<JaegerTag> tags;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerError {
        private int code;
        private String msg;
    }
}

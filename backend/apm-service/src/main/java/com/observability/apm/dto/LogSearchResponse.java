package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Story 6.4 / 6.8 — Paginated log search response.
 * Contains matching log entries from Elasticsearch with pagination metadata.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogSearchResponse {

    /** Total number of matching log entries. */
    private long totalHits;

    /** Current page number (zero-based). */
    private int page;

    /** Page size. */
    private int size;

    /** Total number of pages. */
    private int totalPages;

    /** Log entries for the current page. */
    private List<LogEntry> entries;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LogEntry {

        /** Log record timestamp (ISO-8601). */
        private String timestamp;

        /** Severity level: TRACE, DEBUG, INFO, WARN, ERROR, FATAL. */
        private String severity;

        /** Service name from resource attributes. */
        private String serviceName;

        /** Log message body. */
        private String body;

        /** Logger name / class path (e.g. com.observability.apm.service.MetricsService). */
        private String loggerName;

        /** Source code line number (nullable). */
        private Integer lineNumber;

        /** Trace ID for trace correlation (nullable). */
        private String traceId;

        /** Span ID (nullable). */
        private String spanId;

        /** Additional resource/log attributes. */
        private Map<String, String> attributes;
    }
}

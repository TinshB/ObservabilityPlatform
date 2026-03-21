package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 7.4 — Log enrichment validation report.
 * Verifies that traceId, spanId, and service.name are properly injected
 * into log records by the OTel pipeline.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LogEnrichmentValidationResponse {

    private String serviceName;

    /** Total log records evaluated in the time window. */
    private long totalLogs;

    /** Field-level validation results. */
    private FieldValidation traceId;
    private FieldValidation spanId;
    private FieldValidation serviceName_;

    /** Overall enrichment health score (0.0–1.0). Average of field coverage rates. */
    private double healthScore;

    /** Whether the enrichment is considered healthy (healthScore >= 0.95). */
    private boolean healthy;

    /** Sample log entries missing one or more enrichment fields (up to 5). */
    private List<SampleMissingLog> samplesMissing;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FieldValidation {
        /** Elasticsearch field name. */
        private String field;

        /** Number of logs where this field exists and is non-null. */
        private long presentCount;

        /** Number of logs where this field is missing or null. */
        private long missingCount;

        /** Coverage rate (0.0–1.0). */
        private double coverageRate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SampleMissingLog {
        private String timestamp;
        private String severity;
        private String body;
        private boolean hasTraceId;
        private boolean hasSpanId;
        private boolean hasServiceName;
    }
}

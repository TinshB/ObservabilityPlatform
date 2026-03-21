package com.observability.shared.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

/**
 * Standard envelope returned by {@code GlobalExceptionHandler} for all error responses.
 *
 * <pre>
 * {
 *   "errorCode": "RESOURCE_NOT_FOUND",
 *   "message":   "Service not found: order-service",
 *   "path":      "/api/v1/services/order-service",
 *   "traceId":   "4bf92f3577b34da6a3ce929d0e0e4736",
 *   "timestamp": "2026-04-06T10:00:00Z",
 *   "validationErrors": [...]          // present only on 400 validation failures
 * }
 * </pre>
 */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    private String errorCode;
    private String message;
    private String path;
    private String traceId;

    @Builder.Default
    private Instant timestamp = Instant.now();

    /** Populated only when {@code errorCode = VALIDATION_ERROR}. */
    private List<FieldValidationError> validationErrors;

    // ── Nested type ──────────────────────────────────────────────────────────

    @Data
    @Builder
    public static class FieldValidationError {
        private String field;
        private Object rejectedValue;
        private String message;
    }
}

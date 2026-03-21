package com.observability.shared.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown for business-level validation failures not caught by Bean Validation.
 * Maps to HTTP 400.
 *
 * <p>For constraint annotation failures ({@code @NotNull}, {@code @Size}, etc.)
 * the {@link GlobalExceptionHandler} handles {@code MethodArgumentNotValidException} directly.
 */
public class ValidationException extends ObservabilityException {

    public ValidationException(String message) {
        super("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST);
    }

    public ValidationException(String field, String message) {
        super(
            "VALIDATION_ERROR",
            String.format("Validation failed for '%s': %s", field, message),
            HttpStatus.BAD_REQUEST
        );
    }
}

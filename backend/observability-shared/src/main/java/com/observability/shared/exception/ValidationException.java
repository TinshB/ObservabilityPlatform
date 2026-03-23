package com.observability.shared.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Thrown for business-level validation failures not caught by Bean Validation.
 * Maps to HTTP 400.
 *
 * <p>For constraint annotation failures ({@code @NotNull}, {@code @Size}, etc.)
 * the {@link GlobalExceptionHandler} handles {@code MethodArgumentNotValidException} directly.
 */
@Getter
public class ValidationException extends ObservabilityException {

    /** The request field that caused the error, or {@code null} for general validation failures. */
    private final String field;

    public ValidationException(String message) {
        super("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST);
        this.field = null;
    }

    public ValidationException(String field, String message) {
        super("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST);
        this.field = field;
    }
}

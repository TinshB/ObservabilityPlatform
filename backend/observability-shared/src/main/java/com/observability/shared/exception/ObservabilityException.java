package com.observability.shared.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Base exception for all platform-specific runtime errors.
 *
 * Subclasses map to specific HTTP status codes and are handled centrally
 * by {@link GlobalExceptionHandler}.
 *
 * <p>Hierarchy:
 * <pre>
 *   ObservabilityException (base)
 *   ├── ResourceNotFoundException  → 404
 *   ├── UnauthorizedException      → 401
 *   ├── ForbiddenException         → 403
 *   ├── ValidationException        → 400
 *   └── ConflictException          → 409
 * </pre>
 */
@Getter
public class ObservabilityException extends RuntimeException {

    private final String     errorCode;
    private final HttpStatus httpStatus;

    public ObservabilityException(String errorCode, String message, HttpStatus httpStatus) {
        super(message);
        this.errorCode  = errorCode;
        this.httpStatus = httpStatus;
    }

    public ObservabilityException(String errorCode, String message, HttpStatus httpStatus, Throwable cause) {
        super(message, cause);
        this.errorCode  = errorCode;
        this.httpStatus = httpStatus;
    }
}

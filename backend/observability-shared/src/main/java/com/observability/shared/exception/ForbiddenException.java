package com.observability.shared.exception;

import org.springframework.http.HttpStatus;

/** Thrown when an authenticated user lacks permission for the requested operation. Maps to HTTP 403. */
public class ForbiddenException extends ObservabilityException {

    public ForbiddenException() {
        super("FORBIDDEN", "Access denied: insufficient permissions", HttpStatus.FORBIDDEN);
    }

    public ForbiddenException(String message) {
        super("FORBIDDEN", message, HttpStatus.FORBIDDEN);
    }
}

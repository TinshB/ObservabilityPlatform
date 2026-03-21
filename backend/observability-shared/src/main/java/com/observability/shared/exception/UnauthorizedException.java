package com.observability.shared.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a request lacks valid authentication credentials. Maps to HTTP 401. */
public class UnauthorizedException extends ObservabilityException {

    public UnauthorizedException() {
        super("UNAUTHORIZED", "Authentication required", HttpStatus.UNAUTHORIZED);
    }

    public UnauthorizedException(String message) {
        super("UNAUTHORIZED", message, HttpStatus.UNAUTHORIZED);
    }
}

package com.observability.shared.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a create/update operation conflicts with existing data. Maps to HTTP 409. */
public class ConflictException extends ObservabilityException {

    public ConflictException(String message) {
        super("CONFLICT", message, HttpStatus.CONFLICT);
    }

    public ConflictException(String resource, String identifier) {
        super(
            "CONFLICT",
            String.format("%s already exists: %s", resource, identifier),
            HttpStatus.CONFLICT
        );
    }
}

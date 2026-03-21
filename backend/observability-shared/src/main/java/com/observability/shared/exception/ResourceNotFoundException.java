package com.observability.shared.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a requested resource does not exist. Maps to HTTP 404. */
public class ResourceNotFoundException extends ObservabilityException {

    public ResourceNotFoundException(String resource, String identifier) {
        super(
            "RESOURCE_NOT_FOUND",
            String.format("%s not found: %s", resource, identifier),
            HttpStatus.NOT_FOUND
        );
    }

    public ResourceNotFoundException(String message) {
        super("RESOURCE_NOT_FOUND", message, HttpStatus.NOT_FOUND);
    }
}

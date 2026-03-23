package com.observability.shared.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** Thrown when a create/update operation conflicts with existing data. Maps to HTTP 409. */
@Getter
public class ConflictException extends ObservabilityException {

    /** The request field that caused the conflict, or {@code null} for general conflicts. */
    private final String field;

    public ConflictException(String message) {
        super("CONFLICT", message, HttpStatus.CONFLICT);
        this.field = null;
    }

    public ConflictException(String resource, String identifier) {
        super(
            "CONFLICT",
            String.format("%s already exists: %s", resource, identifier),
            HttpStatus.CONFLICT
        );
        this.field = null;
    }

    /** Creates a conflict exception tied to a specific request field. */
    public static ConflictException forField(String field, String message) {
        return new ConflictException(field, message, true);
    }

    // Boolean param disambiguates from the public (String resource, String identifier) constructor.
    private ConflictException(String field, String message, boolean fieldAware) {
        super("CONFLICT", message, HttpStatus.CONFLICT);
        this.field = field;
    }
}

package com.observability.auth.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * DTO representing an audit event to be indexed in Elasticsearch.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditEvent {

    /** The username or identifier of the actor who performed the action. */
    private String actor;

    /** The action that was performed (e.g., "USER_LOGIN", "USER_LOGOUT"). */
    private String action;

    /** The type of resource affected (e.g., "User", "Role"). */
    private String resource;

    /** The identifier of the specific resource affected. */
    private String resourceId;

    /** Additional context details about the event. */
    private Map<String, Object> details;

    /** When the event occurred. */
    @Builder.Default
    private Instant timestamp = Instant.now();
}

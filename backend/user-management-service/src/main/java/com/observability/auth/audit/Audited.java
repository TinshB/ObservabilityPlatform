package com.observability.auth.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a method for audit logging. When a method annotated with {@code @Audited}
 * returns successfully, the {@link AuditAspect} will capture the event and
 * index it to Elasticsearch via {@link AuditService}.
 *
 * <p>Example usage:
 * <pre>
 * {@code @Audited(action = "USER_LOGIN")}
 * public TokenResponse login(LoginRequest request) { ... }
 * </pre>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {

    /**
     * The audit action identifier (e.g., "USER_LOGIN", "USER_LOGOUT", "ROLE_ASSIGNED").
     */
    String action();
}

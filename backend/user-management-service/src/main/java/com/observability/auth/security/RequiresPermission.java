package com.observability.auth.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Custom security annotation for fine-grained permission checks.
 * Methods annotated with this will be intercepted by {@link PermissionAspect}
 * to verify the current user has the required resource:action authority.
 *
 * <p>Example usage:
 * <pre>
 * {@code @RequiresPermission(resource = "USERS", action = "CREATE")}
 * public void createUser(...) { ... }
 * </pre>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresPermission {

    /**
     * The resource being accessed (e.g., "USERS", "SERVICES", "DASHBOARDS").
     */
    String resource();

    /**
     * The action being performed on the resource (e.g., "CREATE", "READ", "UPDATE", "DELETE").
     */
    String action();
}

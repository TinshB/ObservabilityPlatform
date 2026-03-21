package com.observability.shared.config;

import com.observability.shared.exception.GlobalExceptionHandler;
import com.observability.shared.logging.LoggingAspect;
import com.observability.shared.logging.MdcLoggingFilter;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.context.annotation.Import;

/**
 * Spring Boot auto-configuration for the {@code observability-shared} library.
 *
 * <p>Registered via:
 * {@code META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports}
 *
 * <p>Any microservice that declares {@code observability-shared} as a Maven dependency
 * automatically gets:
 * <ul>
 *   <li>{@link GlobalExceptionHandler} — unified REST error responses</li>
 *   <li>{@link MdcLoggingFilter} — per-request traceId / requestId MDC population</li>
 *   <li>{@link LoggingAspect} — service-layer trace logging</li>
 * </ul>
 */
@AutoConfiguration
@Import({
    GlobalExceptionHandler.class,
    MdcLoggingFilter.class,
    LoggingAspect.class
})
public class SharedAutoConfiguration {
}

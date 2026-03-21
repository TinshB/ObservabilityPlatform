package com.observability.apm.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Story 7.2 — Jaeger Query API connection properties.
 */
@Data
@Component
@ConfigurationProperties(prefix = "jaeger")
public class JaegerProperties {

    /** Jaeger Query API base URL. */
    private String queryUrl = "http://localhost:16686";

    /** Connection timeout in milliseconds. */
    private int connectTimeout = 5000;

    /** Read timeout in milliseconds. */
    private int readTimeout = 30000;
}

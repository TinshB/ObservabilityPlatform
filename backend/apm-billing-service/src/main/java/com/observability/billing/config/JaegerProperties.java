package com.observability.billing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Jaeger Query API connection properties for billing trace queries (US-BILL-003).
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

    /** Average span size in bytes — used to estimate storage from span counts. */
    private int avgSpanSizeBytes = 1024;
}

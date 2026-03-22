package com.observability.billing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Prometheus connection properties for billing storage queries (US-BILL-002).
 */
@Data
@Component
@ConfigurationProperties(prefix = "prometheus")
public class PrometheusProperties {

    /** Base URL of the Prometheus server. */
    private String url = "http://localhost:9090";

    /** Connection timeout in milliseconds. */
    private int connectTimeout = 5000;

    /** Read timeout in milliseconds. */
    private int readTimeout = 30000;
}

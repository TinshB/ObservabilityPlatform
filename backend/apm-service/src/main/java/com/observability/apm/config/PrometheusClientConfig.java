package com.observability.apm.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "prometheus")
public class PrometheusClientConfig {

    /**
     * Base URL of the Prometheus server (e.g. http://localhost:9090).
     */
    private String url = "http://localhost:9090";

    /**
     * Connection timeout in milliseconds.
     */
    private int connectTimeout = 5000;

    /**
     * Read timeout in milliseconds.
     */
    private int readTimeout = 30000;
}

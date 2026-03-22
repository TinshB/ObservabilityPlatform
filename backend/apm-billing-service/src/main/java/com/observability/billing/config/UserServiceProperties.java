package com.observability.billing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * US-BILL-010 — User management service connection properties.
 */
@Data
@Component
@ConfigurationProperties(prefix = "user-service")
public class UserServiceProperties {

    /** Base URL of the user-management-service. */
    private String url = "http://localhost:8081";

    /** Connection timeout in milliseconds. */
    private int connectTimeout = 5000;

    /** Read timeout in milliseconds. */
    private int readTimeout = 10000;
}

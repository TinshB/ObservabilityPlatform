package com.observability.report.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtConfig {

    /**
     * Base64-encoded secret key used for HMAC-SHA512 JWT verification.
     * Must match the secret used by the user-management-service for signing.
     */
    private String secret;
}

package com.observability.auth.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "jwt")
public class JwtConfig {

    /**
     * Base64-encoded secret key used for HMAC-SHA512 JWT signing.
     */
    private String secret;

    /**
     * Access token validity duration in milliseconds (default: 15 minutes).
     */
    private long accessTokenExpiration = 900000;

    /**
     * Refresh token validity duration in milliseconds (default: 7 days).
     */
    private long refreshTokenExpiration = 604800000;
}

package com.observability.auth.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "rate-limit")
public class RateLimitConfig {

    /**
     * Number of tokens added per second (steady-state request rate).
     */
    private int requestsPerSecond = 10;

    /**
     * Maximum number of tokens in the bucket (burst capacity).
     */
    private int burstCapacity = 20;
}

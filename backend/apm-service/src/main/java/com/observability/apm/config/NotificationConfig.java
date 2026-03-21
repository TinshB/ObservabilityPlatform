package com.observability.apm.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Story 10.5 — Configuration for notification subsystem.
 * Provides a RestTemplate bean for Teams webhook calls.
 */
@Configuration
public class NotificationConfig {

    @Bean
    public RestTemplate notificationRestTemplate() {
        return new RestTemplate();
    }
}

package com.observability.ai.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

@Configuration
@ConfigurationProperties(prefix = "apm.service")
@Getter @Setter
public class ApmServiceConfig {

    private String baseUrl = "http://localhost:8082";
    private int connectTimeoutMs = 5000;
    private int readTimeoutMs = 30000;

    @Bean("apmServiceRestTemplate")
    public RestTemplate apmServiceRestTemplate(RestTemplateBuilder builder) {
        return builder
                .rootUri(baseUrl)
                .connectTimeout(Duration.ofMillis(connectTimeoutMs))
                .readTimeout(Duration.ofMillis(readTimeoutMs))
                .build();
    }
}

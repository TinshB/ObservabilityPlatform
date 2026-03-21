package com.observability.report.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSyntheticCheckRequest {

    @NotBlank(message = "Check name is required")
    private String name;

    private UUID serviceId;

    private String serviceName;

    @NotBlank(message = "URL is required")
    private String url;

    @NotBlank(message = "HTTP method is required")
    private String httpMethod;

    private Map<String, String> requestHeaders;

    private String requestBody;

    @NotBlank(message = "Schedule cron expression is required")
    private String scheduleCron;

    @NotNull(message = "Timeout is required")
    @Positive(message = "Timeout must be positive")
    private Integer timeoutMs;

    private Integer expectedStatusCode;

    private String expectedBodyContains;

    private Integer maxLatencyMs;

    private UUID slaRuleId;
}

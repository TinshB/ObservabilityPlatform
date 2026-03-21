package com.observability.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyntheticCheckResponse {

    private UUID id;
    private String name;
    private UUID serviceId;
    private String serviceName;
    private String url;
    private String httpMethod;
    private Map<String, String> requestHeaders;
    private String requestBody;
    private String scheduleCron;
    private int timeoutMs;
    private Integer expectedStatusCode;
    private String expectedBodyContains;
    private Integer maxLatencyMs;
    private UUID slaRuleId;
    private boolean active;
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}

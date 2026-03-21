package com.observability.report.dto;

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
public class UpdateSyntheticCheckRequest {

    private String name;
    private String url;
    private String httpMethod;
    private Map<String, String> requestHeaders;
    private String requestBody;
    private String scheduleCron;
    private Integer timeoutMs;
    private Integer expectedStatusCode;
    private String expectedBodyContains;
    private Integer maxLatencyMs;
    private UUID slaRuleId;
    private Boolean active;
}

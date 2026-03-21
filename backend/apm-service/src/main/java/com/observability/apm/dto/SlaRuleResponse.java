package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Story 10.1 — SLA rule response DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SlaRuleResponse {

    private UUID id;
    private UUID serviceId;
    private String serviceName;
    private String name;
    private String description;
    private String signalType;
    private String metricName;
    private String logCondition;
    private String operator;
    private double threshold;
    private String evaluationWindow;
    private int pendingPeriods;
    private String severity;
    private boolean enabled;
    private String groupKey;
    private String suppressionWindow;
    private List<ChannelSummary> channels;
    private Instant createdAt;
    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChannelSummary {
        private UUID id;
        private String name;
        private String channelType;
    }
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Story 10.1 — Request payload for updating an SLA rule.
 * All fields are optional — only non-null fields are applied.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateSlaRuleRequest {

    private String name;
    private String description;
    private String signalType;
    private String metricName;
    private String logCondition;
    private String operator;
    private Double threshold;
    private String evaluationWindow;
    private Integer pendingPeriods;
    private String severity;
    private Boolean enabled;
    private String groupKey;
    private String suppressionWindow;
    private List<UUID> channelIds;
}

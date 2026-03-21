package com.observability.apm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Story 10.1 — Request payload for creating an SLA rule.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateSlaRuleRequest {

    @NotNull
    private UUID serviceId;

    @NotBlank
    private String name;

    private String description;

    /** METRICS or LOGS */
    @NotBlank
    private String signalType;

    /** PromQL metric name (required when signalType = METRICS) */
    private String metricName;

    /** Severity/keyword condition (required when signalType = LOGS) */
    private String logCondition;

    /** GT, GTE, LT, LTE, EQ, NEQ */
    @NotBlank
    private String operator;

    @NotNull
    private Double threshold;

    /** e.g. "5m", "15m", "1h" — defaults to "5m" */
    private String evaluationWindow;

    /** How many consecutive breach cycles before firing — defaults to 1 */
    private Integer pendingPeriods;

    /** CRITICAL, WARNING, INFO — defaults to WARNING */
    private String severity;

    /** Story 11.2: Grouping key — "service", "service+severity", "service+signal", "none" */
    private String groupKey;

    /** Story 11.2: Suppression window — e.g. "15m", "1h". Defaults to "15m" */
    private String suppressionWindow;

    /** Channel IDs to attach to this rule */
    private List<UUID> channelIds;
}

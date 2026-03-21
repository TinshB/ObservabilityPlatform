package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 10.6 — Alert channel response DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertChannelResponse {

    private UUID id;
    private String name;
    private String channelType;
    private String config;
    private boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;
}

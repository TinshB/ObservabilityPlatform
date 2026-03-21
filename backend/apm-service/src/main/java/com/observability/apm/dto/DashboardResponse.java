package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 13.1 — Dashboard response DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardResponse {

    private UUID id;
    private String name;
    private String description;
    private UUID ownerId;
    private boolean isTemplate;
    private String tags;
    private String layout;
    private int widgetCount;
    private Instant createdAt;
    private Instant updatedAt;
}

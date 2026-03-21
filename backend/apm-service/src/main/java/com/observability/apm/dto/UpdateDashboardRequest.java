package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 13.1 — Request payload for updating a dashboard.
 * Only non-null fields are applied.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateDashboardRequest {

    private String name;

    private String description;

    private Boolean isTemplate;

    private String tags;

    /** JSONB layout string — replaces the entire layout when provided. */
    private String layout;
}

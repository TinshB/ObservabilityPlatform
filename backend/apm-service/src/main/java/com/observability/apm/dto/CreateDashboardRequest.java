package com.observability.apm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Story 13.1 — Request payload for creating a dashboard.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateDashboardRequest {

    @NotBlank
    private String name;

    private String description;

    @NotNull
    private UUID ownerId;

    private Boolean isTemplate;

    private String tags;

    /** JSONB layout string containing widgets and variables configuration. */
    private String layout;
}

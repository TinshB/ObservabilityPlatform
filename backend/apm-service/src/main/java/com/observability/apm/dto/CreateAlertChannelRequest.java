package com.observability.apm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 10.6 — Create alert channel request DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateAlertChannelRequest {

    @NotBlank(message = "Channel name is required")
    private String name;

    /** EMAIL, SMS, MS_TEAMS */
    @NotBlank(message = "Channel type is required")
    private String channelType;

    /**
     * Channel-specific JSON config.
     * EMAIL:    { "recipients": ["a@b.com"], "from": "alerts@obs.io" }
     * SMS:      { "phoneNumbers": ["+1234567890"] }
     * MS_TEAMS: { "webhookUrl": "https://..." }
     */
    @NotNull(message = "Config is required")
    private String config;
}

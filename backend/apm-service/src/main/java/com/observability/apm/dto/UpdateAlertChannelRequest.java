package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Story 10.6 — Update alert channel request DTO.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateAlertChannelRequest {

    private String name;
    private String channelType;
    private String config;
    private Boolean enabled;
}

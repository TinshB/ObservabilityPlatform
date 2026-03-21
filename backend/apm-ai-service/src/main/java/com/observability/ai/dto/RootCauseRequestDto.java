package com.observability.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RootCauseRequestDto {

    @NotBlank
    private String serviceName;

    private long incidentStartMs;

    private long incidentEndMs;
}

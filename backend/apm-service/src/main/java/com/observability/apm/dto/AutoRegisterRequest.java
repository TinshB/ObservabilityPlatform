package com.observability.apm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request payload used by the OTel Collector (or pipeline webhook) to auto-register
 * a service when telemetry bearing a new {@code service.name} attribute is first received.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AutoRegisterRequest {

    @NotBlank(message = "Service name (service.name attribute) is required")
    @Size(max = 255, message = "Service name must not exceed 255 characters")
    private String serviceName;

    private String environment;
}

package com.observability.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class AnomalyDetectionRequestDto {

    @NotBlank
    private String serviceName;

    @NotBlank
    private String metricName;

    private List<DataPointDto> dataPoints;

    private double sensitivity = 0.5;

    private String algorithm = "isolation_forest";

    @Data
    public static class DataPointDto {
        private long timestampMs;
        private double value;
    }
}

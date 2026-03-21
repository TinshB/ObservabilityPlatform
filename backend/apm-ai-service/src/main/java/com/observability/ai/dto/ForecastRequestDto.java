package com.observability.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.List;

@Data
public class ForecastRequestDto {

    @NotBlank
    private String serviceName;

    @NotBlank
    private String metricName;

    private List<AnomalyDetectionRequestDto.DataPointDto> historicalData;

    @Positive
    private int forecastHorizonMinutes = 60;

    private String algorithm = "prophet";
}

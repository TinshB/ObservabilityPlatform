package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ForecastResponseDto {
    private List<ForecastPointDto> forecast;
    private String modelVersion;
    private double executionTimeMs;

    @Data
    @Builder
    public static class ForecastPointDto {
        private long timestampMs;
        private double predictedValue;
        private double lowerBound;
        private double upperBound;
    }
}

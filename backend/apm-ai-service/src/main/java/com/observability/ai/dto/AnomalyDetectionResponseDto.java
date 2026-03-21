package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AnomalyDetectionResponseDto {
    private List<AnomalyDto> anomalies;
    private String modelVersion;
    private double executionTimeMs;

    @Data
    @Builder
    public static class AnomalyDto {
        private long timestampMs;
        private double value;
        private double score;
        private double expectedValue;
        private double lowerBound;
        private double upperBound;
        private String severity;
    }
}

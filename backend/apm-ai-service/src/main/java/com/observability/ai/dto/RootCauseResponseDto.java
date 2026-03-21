package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class RootCauseResponseDto {
    private List<CauseDto> causes;
    private String analysisSummary;
    private double confidence;
    private double executionTimeMs;

    @Data
    @Builder
    public static class CauseDto {
        private String serviceName;
        private String component;
        private String description;
        private double probability;
        private List<String> evidence;
    }
}

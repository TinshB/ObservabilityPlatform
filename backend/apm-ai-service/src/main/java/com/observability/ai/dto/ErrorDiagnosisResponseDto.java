package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ErrorDiagnosisResponseDto {
    private String traceId;
    private String summary;
    private List<SuggestionDto> suggestions;
    private double confidence;
    private String llmModel;
    private double executionTimeMs;

    @Data
    @Builder
    public static class SuggestionDto {
        private String spanId;
        private String serviceName;
        private String errorType;
        private String diagnosis;
        private String suggestedFix;
        private String codeSnippet;
        private String severity;
        private List<String> references;
    }
}

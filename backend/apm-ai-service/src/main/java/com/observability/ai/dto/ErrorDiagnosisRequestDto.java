package com.observability.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ErrorDiagnosisRequestDto {

    @NotBlank
    private String traceId;

    @NotEmpty
    private List<ErrorSpanDto> errorSpans;

    private List<String> associatedLogs;

    private String languageHint;

    @Data
    public static class ErrorSpanDto {
        private String spanId;
        private String serviceName;
        private String operation;
        private long durationMicros;
        private String httpMethod;
        private String httpUrl;
        private int httpStatusCode;
        private Map<String, String> tags;
        private List<String> errorLogs;
    }
}

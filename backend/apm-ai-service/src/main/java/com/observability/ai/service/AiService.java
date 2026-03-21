package com.observability.ai.service;

import com.observability.ai.config.LlmConfig;
import com.observability.ai.dto.*;
import com.observability.ai.grpc.MlSidecarClient;
import com.observability.ai.proto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Orchestration layer between REST controllers and the Python ML sidecar.
 * Converts REST DTOs to protobuf messages, invokes the sidecar via gRPC,
 * and converts protobuf responses back to JSON-safe DTOs.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final MlSidecarClient sidecarClient;
    private final LlmConfig llmConfig;

    public AnomalyDetectionResponseDto detectAnomalies(AnomalyDetectionRequestDto dto) {
        log.info("Running anomaly detection for service={} metric={} algorithm={}",
                dto.getServiceName(), dto.getMetricName(), dto.getAlgorithm());

        var builder = AnomalyDetectionRequest.newBuilder()
                .setServiceName(dto.getServiceName())
                .setMetricName(dto.getMetricName())
                .setSensitivity(dto.getSensitivity())
                .setAlgorithm(dto.getAlgorithm());

        if (dto.getDataPoints() != null) {
            dto.getDataPoints().forEach(dp ->
                builder.addDataPoints(DataPoint.newBuilder()
                        .setTimestampMs(dp.getTimestampMs())
                        .setValue(dp.getValue())
                        .build())
            );
        }

        var response = sidecarClient.detectAnomalies(builder.build());

        return AnomalyDetectionResponseDto.builder()
                .modelVersion(response.getModelVersion())
                .executionTimeMs(response.getExecutionTimeMs())
                .anomalies(response.getAnomaliesList().stream()
                        .map(a -> AnomalyDetectionResponseDto.AnomalyDto.builder()
                                .timestampMs(a.getTimestampMs())
                                .value(a.getValue())
                                .score(a.getScore())
                                .expectedValue(a.getExpectedValue())
                                .lowerBound(a.getLowerBound())
                                .upperBound(a.getUpperBound())
                                .severity(a.getSeverity())
                                .build())
                        .toList())
                .build();
    }

    public RootCauseResponseDto analyzeRootCause(RootCauseRequestDto dto) {
        log.info("Running root cause analysis for service={} window=[{}, {}]",
                dto.getServiceName(), dto.getIncidentStartMs(), dto.getIncidentEndMs());

        var request = RootCauseRequest.newBuilder()
                .setServiceName(dto.getServiceName())
                .setIncidentStartMs(dto.getIncidentStartMs())
                .setIncidentEndMs(dto.getIncidentEndMs())
                .build();

        var response = sidecarClient.analyzeRootCause(request);

        return RootCauseResponseDto.builder()
                .analysisSummary(response.getAnalysisSummary())
                .confidence(response.getConfidence())
                .executionTimeMs(response.getExecutionTimeMs())
                .causes(response.getCausesList().stream()
                        .map(c -> RootCauseResponseDto.CauseDto.builder()
                                .serviceName(c.getServiceName())
                                .component(c.getComponent())
                                .description(c.getDescription())
                                .probability(c.getProbability())
                                .evidence(List.copyOf(c.getEvidenceList()))
                                .build())
                        .toList())
                .build();
    }

    public ForecastResponseDto forecast(ForecastRequestDto dto) {
        log.info("Running forecast for service={} metric={} horizon={}min algorithm={}",
                dto.getServiceName(), dto.getMetricName(),
                dto.getForecastHorizonMinutes(), dto.getAlgorithm());

        var builder = ForecastRequest.newBuilder()
                .setServiceName(dto.getServiceName())
                .setMetricName(dto.getMetricName())
                .setForecastHorizonMinutes(dto.getForecastHorizonMinutes())
                .setAlgorithm(dto.getAlgorithm());

        if (dto.getHistoricalData() != null) {
            dto.getHistoricalData().forEach(dp ->
                builder.addHistoricalData(DataPoint.newBuilder()
                        .setTimestampMs(dp.getTimestampMs())
                        .setValue(dp.getValue())
                        .build())
            );
        }

        var response = sidecarClient.forecast(builder.build());

        return ForecastResponseDto.builder()
                .modelVersion(response.getModelVersion())
                .executionTimeMs(response.getExecutionTimeMs())
                .forecast(response.getForecastList().stream()
                        .map(fp -> ForecastResponseDto.ForecastPointDto.builder()
                                .timestampMs(fp.getTimestampMs())
                                .predictedValue(fp.getPredictedValue())
                                .lowerBound(fp.getLowerBound())
                                .upperBound(fp.getUpperBound())
                                .build())
                        .toList())
                .build();
    }

    public ErrorDiagnosisResponseDto diagnoseErrors(ErrorDiagnosisRequestDto dto) {
        log.info("Running error diagnosis for traceId={} with {} error spans",
                dto.getTraceId(), dto.getErrorSpans().size());

        var builder = ErrorDiagnosisRequest.newBuilder()
                .setTraceId(dto.getTraceId())
                .setLlmConfig(com.observability.ai.proto.LlmConfig.newBuilder()
                        .setProvider(llmConfig.getProvider())
                        .setApiKey(llmConfig.getActiveApiKey())
                        .setModel(llmConfig.getActiveModel())
                        .build());

        if (dto.getLanguageHint() != null) {
            builder.setLanguageHint(dto.getLanguageHint());
        }

        if (dto.getAssociatedLogs() != null) {
            builder.addAllAssociatedLogs(dto.getAssociatedLogs());
        }

        for (var spanDto : dto.getErrorSpans()) {
            var spanBuilder = ErrorSpan.newBuilder()
                    .setSpanId(spanDto.getSpanId() != null ? spanDto.getSpanId() : "")
                    .setServiceName(spanDto.getServiceName() != null ? spanDto.getServiceName() : "")
                    .setOperation(spanDto.getOperation() != null ? spanDto.getOperation() : "")
                    .setDurationMicros(spanDto.getDurationMicros())
                    .setHttpMethod(spanDto.getHttpMethod() != null ? spanDto.getHttpMethod() : "")
                    .setHttpUrl(spanDto.getHttpUrl() != null ? spanDto.getHttpUrl() : "")
                    .setHttpStatusCode(spanDto.getHttpStatusCode());

            if (spanDto.getTags() != null) {
                spanBuilder.putAllTags(spanDto.getTags());
            }
            if (spanDto.getErrorLogs() != null) {
                spanBuilder.addAllErrorLogs(spanDto.getErrorLogs());
            }

            builder.addErrorSpans(spanBuilder.build());
        }

        var response = sidecarClient.diagnoseErrors(builder.build());

        return ErrorDiagnosisResponseDto.builder()
                .traceId(response.getTraceId())
                .summary(response.getSummary())
                .confidence(response.getConfidence())
                .llmModel(response.getLlmModel())
                .executionTimeMs(response.getExecutionTimeMs())
                .suggestions(response.getSuggestionsList().stream()
                        .map(s -> ErrorDiagnosisResponseDto.SuggestionDto.builder()
                                .spanId(s.getSpanId())
                                .serviceName(s.getServiceName())
                                .errorType(s.getErrorType())
                                .diagnosis(s.getDiagnosis())
                                .suggestedFix(s.getSuggestedFix())
                                .codeSnippet(s.getCodeSnippet())
                                .severity(s.getSeverity())
                                .references(List.copyOf(s.getReferencesList()))
                                .build())
                        .toList())
                .build();
    }

    public Map<String, Object> healthCheck() {
        var response = sidecarClient.checkHealth();
        return Map.of(
                "status", response.getStatus(),
                "pythonVersion", response.getPythonVersion(),
                "loadedModels", response.getLoadedModelsList(),
                "uptimeSeconds", response.getUptimeSeconds()
        );
    }
}

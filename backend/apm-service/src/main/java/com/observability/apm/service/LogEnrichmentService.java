package com.observability.apm.service;

import com.observability.apm.dto.LogEnrichmentValidationResponse;
import com.observability.apm.dto.LogEnrichmentValidationResponse.FieldValidation;
import com.observability.apm.dto.LogEnrichmentValidationResponse.SampleMissingLog;
import com.observability.apm.dto.LogSearchResponse;
import com.observability.apm.elasticsearch.ElasticsearchLogClient;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Story 7.4 — Log enrichment validation service.
 * Checks whether log records emitted by a service are properly enriched
 * with traceId, spanId, and service.name by the OTel pipeline.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LogEnrichmentService {

    private static final double HEALTHY_THRESHOLD = 0.95;
    private static final int MAX_SAMPLES = 5;

    // Elasticsearch field paths (matching OTel log schema)
    private static final String TRACE_ID_FIELD = "trace_id";
    private static final String SPAN_ID_FIELD = "span_id";
    private static final String SERVICE_NAME_FIELD = "resource.attributes.service.name";

    private final ServiceRepository serviceRepository;
    private final ElasticsearchLogClient esLogClient;

    /**
     * Validate log enrichment for a service within a time window.
     *
     * @param serviceId service UUID
     * @param start     range start
     * @param end       range end
     * @return validation report with field coverage and sample missing logs
     */
    public LogEnrichmentValidationResponse validate(UUID serviceId, Instant start, Instant end) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();

        // Total log count
        long totalLogs = esLogClient.countTotalLogs(serviceName, start, end);

        if (totalLogs == 0) {
            return LogEnrichmentValidationResponse.builder()
                    .serviceName(serviceName)
                    .totalLogs(0)
                    .traceId(emptyValidation(TRACE_ID_FIELD))
                    .spanId(emptyValidation(SPAN_ID_FIELD))
                    .serviceName_(emptyValidation(SERVICE_NAME_FIELD))
                    .healthScore(0.0)
                    .healthy(false)
                    .samplesMissing(List.of())
                    .build();
        }

        // Count logs with each enrichment field present
        long traceIdCount = esLogClient.countLogsWithField(serviceName, TRACE_ID_FIELD, start, end);
        long spanIdCount = esLogClient.countLogsWithField(serviceName, SPAN_ID_FIELD, start, end);
        long serviceNameCount = esLogClient.countLogsWithField(serviceName, SERVICE_NAME_FIELD, start, end);

        FieldValidation traceIdValidation = buildFieldValidation(TRACE_ID_FIELD, traceIdCount, totalLogs);
        FieldValidation spanIdValidation = buildFieldValidation(SPAN_ID_FIELD, spanIdCount, totalLogs);
        FieldValidation serviceNameValidation = buildFieldValidation(SERVICE_NAME_FIELD, serviceNameCount, totalLogs);

        double healthScore = (traceIdValidation.getCoverageRate()
                + spanIdValidation.getCoverageRate()
                + serviceNameValidation.getCoverageRate()) / 3.0;

        // Find sample logs missing enrichment
        List<LogSearchResponse.LogEntry> missingEntries =
                esLogClient.findLogsMissingEnrichment(serviceName, start, end, MAX_SAMPLES);

        List<SampleMissingLog> samples = missingEntries.stream()
                .map(e -> SampleMissingLog.builder()
                        .timestamp(e.getTimestamp())
                        .severity(e.getSeverity())
                        .body(e.getBody() != null && e.getBody().length() > 200
                                ? e.getBody().substring(0, 200) + "..." : e.getBody())
                        .hasTraceId(e.getTraceId() != null && !e.getTraceId().isBlank())
                        .hasSpanId(e.getSpanId() != null && !e.getSpanId().isBlank())
                        .hasServiceName(e.getServiceName() != null && !e.getServiceName().isBlank())
                        .build())
                .toList();

        return LogEnrichmentValidationResponse.builder()
                .serviceName(serviceName)
                .totalLogs(totalLogs)
                .traceId(traceIdValidation)
                .spanId(spanIdValidation)
                .serviceName_(serviceNameValidation)
                .healthScore(Math.round(healthScore * 10000.0) / 10000.0) // 4 decimal places
                .healthy(healthScore >= HEALTHY_THRESHOLD)
                .samplesMissing(samples)
                .build();
    }

    private FieldValidation buildFieldValidation(String field, long presentCount, long totalLogs) {
        long missingCount = totalLogs - presentCount;
        double coverage = totalLogs > 0 ? (double) presentCount / totalLogs : 0.0;
        return FieldValidation.builder()
                .field(field)
                .presentCount(presentCount)
                .missingCount(missingCount)
                .coverageRate(Math.round(coverage * 10000.0) / 10000.0)
                .build();
    }

    private FieldValidation emptyValidation(String field) {
        return FieldValidation.builder()
                .field(field)
                .presentCount(0)
                .missingCount(0)
                .coverageRate(0.0)
                .build();
    }
}

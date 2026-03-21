package com.observability.apm.service;

import com.observability.apm.dto.CorrelationResponse;
import com.observability.apm.dto.LogSearchResponse;
import com.observability.apm.dto.TraceDetailResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Story 9.1 — Cross-signal correlation service.
 * Given a trace ID, assembles trace detail, a metrics snapshot for the root
 * service, and correlated logs into a single response.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CorrelationService {

    private final TraceService traceService;
    private final MetricsService metricsService;
    private final LogSearchService logSearchService;

    private static final String DEFAULT_RATE_WINDOW = "5m";

    /**
     * Build a unified correlation response for the given trace.
     *
     * @param traceId the distributed trace ID
     * @return correlation response with trace, metrics snapshot, and related logs
     */
    public CorrelationResponse getCorrelation(String traceId) {
        // 1. Get full trace detail
        TraceDetailResponse trace = traceService.getTraceDetail(traceId);

        // 2. Extract root service name (first service in the sorted list)
        String rootService = trace.getServices() != null && !trace.getServices().isEmpty()
                ? trace.getServices().getFirst()
                : "unknown";

        // 3. Build metrics snapshot for the root service using instant queries
        CorrelationResponse.MetricsSnapshot metricsSnapshot = buildMetricsSnapshot(rootService);

        // 4. Query correlated logs by trace ID
        //    Determine time window from the trace for log scoping
        Instant traceStart = Instant.parse(trace.getStartTime());
        long durationMicros = trace.getDurationMicros();
        // Add 1 minute buffer before and after the trace window
        Instant logStart = traceStart.minusSeconds(60);
        Instant logEnd = traceStart.plusNanos(durationMicros * 1000).plusSeconds(60);

        LogSearchResponse relatedLogs = logSearchService.searchLogs(
                null, null, null, traceId,
                logStart, logEnd, 0, 100);

        return CorrelationResponse.builder()
                .trace(trace)
                .metricsSnapshot(metricsSnapshot)
                .relatedLogs(relatedLogs)
                .build();
    }

    private CorrelationResponse.MetricsSnapshot buildMetricsSnapshot(String serviceName) {
        try {
            var instant = metricsService.getInstantMetricsForService(serviceName, DEFAULT_RATE_WINDOW);
            return CorrelationResponse.MetricsSnapshot.builder()
                    .serviceName(serviceName)
                    .latencyP50(instant.getLatencyP50())
                    .latencyP95(instant.getLatencyP95())
                    .latencyP99(instant.getLatencyP99())
                    .errorRate(instant.getErrorRate())
                    .requestRate(instant.getRequestRate())
                    .build();
        } catch (Exception e) {
            log.warn("Failed to fetch metrics snapshot for service '{}': {}", serviceName, e.getMessage());
            return CorrelationResponse.MetricsSnapshot.builder()
                    .serviceName(serviceName)
                    .build();
        }
    }
}

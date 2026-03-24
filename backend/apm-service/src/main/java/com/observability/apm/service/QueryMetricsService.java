package com.observability.apm.service;

import com.observability.apm.config.QueryMetricsProperties;
import com.observability.apm.dto.QueryMetricsResponse;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Story 6.2 — Query-level metrics service.
 *
 * <p>Orchestrator that delegates to either Jaeger-based (default) or
 * Prometheus-based query metrics provider based on configuration.
 *
 * <p>Configure via {@code metrics.query-metrics-source}:
 * <ul>
 *   <li>{@code jaeger} (default) — extracts DB operation stats from Jaeger trace spans</li>
 *   <li>{@code prometheus} — queries OTel DB histogram metrics from Prometheus</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QueryMetricsService {

    private final PrometheusQueryMetricsProvider prometheusProvider;
    private final JaegerQueryMetricsProvider jaegerProvider;
    private final ServiceRepository serviceRepository;
    private final QueryMetricsProperties config;

    /**
     * Fetch query-level metrics for a service.
     *
     * @param serviceId   service UUID
     * @param start       range start
     * @param end         range end
     * @param stepSeconds resolution step in seconds
     * @param rateWindow  PromQL rate window (used only by Prometheus provider)
     * @return query metrics response
     */
    public QueryMetricsResponse getQueryMetrics(UUID serviceId, Instant start, Instant end,
                                                  long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();
        String source = config.getQueryMetricsSource();

        log.debug("Query metrics for service {} using source: {}", serviceName, source);

        if ("prometheus".equalsIgnoreCase(source)) {
            return prometheusProvider.getQueryMetrics(serviceName, start, end, stepSeconds, rateWindow);
        } else {
            return jaegerProvider.getQueryMetrics(serviceName, start, end, stepSeconds);
        }
    }
}

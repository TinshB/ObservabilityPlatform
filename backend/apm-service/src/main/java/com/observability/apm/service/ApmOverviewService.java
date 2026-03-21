package com.observability.apm.service;

import com.observability.apm.dto.ApmOverviewResponse;
import com.observability.apm.dto.ApmOverviewResponse.ServiceHealthSummary;
import com.observability.apm.dto.ApmOverviewResponse.SignalCounts;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.prometheus.PromQLBuilder;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import com.observability.apm.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Story 8.3 — APM Overview service.
 * Builds a platform-wide health summary by querying Prometheus for key metrics
 * of every active service and computing per-service health scores.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ApmOverviewService {

    private static final String DURATION_METRIC = "http_server_request_duration_seconds_bucket";
    private static final String COUNT_METRIC = "http_server_request_duration_seconds_count";
    private static final String SERVICE_LABEL = "job";
    private static final String STATUS_LABEL = "http_response_status_code";

    private static final int TOP_UNHEALTHY_COUNT = 5;

    private final ServiceRepository serviceRepository;
    private final PrometheusClient prometheusClient;

    /**
     * Build a platform-wide APM overview.
     *
     * @param rateWindow PromQL rate window (e.g. "5m")
     * @return APM overview response
     */
    public ApmOverviewResponse getOverview(String rateWindow) {
        // Fetch all active services
        List<ServiceEntity> activeServices = serviceRepository
                .findWithFilters(null, null, null, null, true, PageRequest.of(0, 1000))
                .getContent();

        int totalServices = activeServices.size();

        // Signal counts
        int metricsEnabled = 0, logsEnabled = 0, tracesEnabled = 0;
        for (ServiceEntity svc : activeServices) {
            if (svc.isMetricsEnabled()) metricsEnabled++;
            if (svc.isLogsEnabled()) logsEnabled++;
            if (svc.isTracesEnabled()) tracesEnabled++;
        }

        SignalCounts signalCounts = SignalCounts.builder()
                .metricsEnabled(metricsEnabled)
                .logsEnabled(logsEnabled)
                .tracesEnabled(tracesEnabled)
                .build();

        // Compute per-service health
        List<ServiceHealthSummary> summaries = new ArrayList<>();
        for (ServiceEntity svc : activeServices) {
            summaries.add(buildServiceHealth(svc, rateWindow));
        }

        // Sort by health score ascending (worst first)
        summaries.sort(Comparator.comparingDouble(ServiceHealthSummary::getHealthScore));

        // Health distribution
        Map<String, Integer> healthDist = new LinkedHashMap<>();
        healthDist.put("healthy", 0);
        healthDist.put("degraded", 0);
        healthDist.put("unhealthy", 0);
        healthDist.put("unknown", 0);
        for (ServiceHealthSummary s : summaries) {
            healthDist.merge(s.getHealthStatus(), 1, Integer::sum);
        }

        // Top N unhealthy (exclude healthy and unknown)
        List<ServiceHealthSummary> topUnhealthy = summaries.stream()
                .filter(s -> !"healthy".equals(s.getHealthStatus()) && !"unknown".equals(s.getHealthStatus()))
                .limit(TOP_UNHEALTHY_COUNT)
                .toList();

        return ApmOverviewResponse.builder()
                .totalServices(totalServices)
                .healthDistribution(healthDist)
                .signalCounts(signalCounts)
                .topUnhealthy(topUnhealthy)
                .services(summaries)
                .build();
    }

    // ── Per-service health computation ──────────────────────────────────────

    private ServiceHealthSummary buildServiceHealth(ServiceEntity svc, String rateWindow) {
        String serviceName = svc.getName();

        Double latencyP95 = null;
        Double errorRate = null;
        Double requestRate = null;

        if (svc.isMetricsEnabled()) {
            latencyP95 = queryInstantLatency(serviceName, 0.95, rateWindow);
            errorRate = queryInstantErrorRate(serviceName, rateWindow);
            requestRate = queryInstantRequestRate(serviceName, rateWindow);
        }

        double healthScore = computeHealthScore(latencyP95, errorRate);
        String healthStatus;
        if (latencyP95 == null && errorRate == null && requestRate == null) {
            healthStatus = "unknown";
            healthScore = 1.0; // no data → assume healthy for sorting
        } else {
            healthStatus = healthScore >= 0.9 ? "healthy"
                    : healthScore >= 0.7 ? "degraded"
                    : "unhealthy";
        }

        return ServiceHealthSummary.builder()
                .serviceId(svc.getId().toString())
                .serviceName(serviceName)
                .environment(svc.getEnvironment())
                .ownerTeam(svc.getOwnerTeam())
                .tier(svc.getTier())
                .healthScore(Math.round(healthScore * 1000.0) / 1000.0)
                .healthStatus(healthStatus)
                .latencyP95(latencyP95)
                .errorRate(errorRate)
                .requestRate(requestRate)
                .build();
    }

    /**
     * Lightweight health score from error rate and P95 latency.
     * Error rate weighted 60%, latency 40%.
     */
    private double computeHealthScore(Double latencyP95, Double errorRate) {
        double score = 0;
        double totalWeight = 0;

        if (errorRate != null) {
            double errScore = (errorRate <= 0.01) ? 1.0
                    : (errorRate >= 0.10) ? 0.0
                    : 1.0 - (errorRate - 0.01) / (0.10 - 0.01);
            score += 0.6 * errScore;
            totalWeight += 0.6;
        }

        if (latencyP95 != null) {
            double latScore = (latencyP95 <= 0.2) ? 1.0
                    : (latencyP95 >= 2.0) ? 0.0
                    : 1.0 - (latencyP95 - 0.2) / (2.0 - 0.2);
            score += 0.4 * latScore;
            totalWeight += 0.4;
        }

        return totalWeight > 0 ? score / totalWeight : 1.0;
    }

    // ── Prometheus instant query helpers ─────────────────────────────────────

    private Double queryInstantLatency(String serviceName, double quantile, String rateWindow) {
        String query = PromQLBuilder.metric(DURATION_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();
        return extractInstantValue(prometheusClient.query(query));
    }

    private Double queryInstantErrorRate(String serviceName, String rateWindow) {
        String errors = PromQLBuilder.metric(COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .label(STATUS_LABEL, "=~", "5..")
                .rate(rateWindow)
                .sum()
                .build();
        String total = PromQLBuilder.metric(COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();
        return extractInstantValue(prometheusClient.query(errors + " / " + total));
    }

    private Double queryInstantRequestRate(String serviceName, String rateWindow) {
        String query = PromQLBuilder.metric(COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();
        return extractInstantValue(prometheusClient.query(query));
    }

    private Double extractInstantValue(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return null;
        }
        PrometheusResponse.PromResult first = response.getData().getResult().getFirst();
        if (first.getValue() != null && first.getValue().size() >= 2) {
            try {
                double val = Double.parseDouble(first.getValue().get(1).toString());
                return Double.isNaN(val) ? null : val;
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }
}

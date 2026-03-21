package com.observability.apm.service;

import com.observability.apm.dto.DependencyMetricsResponse;
import com.observability.apm.dto.DependencyMetricsResponse.InstantDependencyMetrics;
import com.observability.apm.dto.MetricDataPoint;
import com.observability.apm.dto.TimeSeries;
import com.observability.apm.entity.DependencyEntity;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.prometheus.PromQLBuilder;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import com.observability.apm.repository.DependencyRepository;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Story 11.4 — Per-dependency metrics service.
 * Queries Prometheus for client-side OTel metrics scoped to specific dependency edges.
 *
 * <p>OTel client instrumentation metric conventions:
 * <ul>
 *   <li>HTTP: {@code http_client_request_duration_seconds_bucket{job, peer_service}}</li>
 *   <li>gRPC: {@code rpc_client_duration_seconds_bucket{job, rpc_service}}</li>
 *   <li>DB:   {@code db_client_connections_usage{job, db_system}} and
 *             {@code db_client_operation_duration_seconds_bucket{job, db_system}}</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DependencyMetricsService {

    private final PrometheusClient prometheusClient;
    private final DependencyRepository dependencyRepository;
    private final ServiceRepository serviceRepository;

    // ── OTel client-side metric names ──────────────────────────────────────────
    private static final String HTTP_CLIENT_DURATION_BUCKET = "http_client_request_duration_seconds_bucket";
    private static final String HTTP_CLIENT_DURATION_COUNT  = "http_client_request_duration_seconds_count";
    private static final String GRPC_CLIENT_DURATION_BUCKET = "rpc_client_duration_seconds_bucket";
    private static final String GRPC_CLIENT_DURATION_COUNT  = "rpc_client_duration_seconds_count";
    private static final String DB_OPERATION_DURATION_BUCKET = "db_client_operation_duration_seconds_bucket";
    private static final String DB_OPERATION_DURATION_COUNT  = "db_client_operation_duration_seconds_count";

    private static final String SERVICE_LABEL = "job";
    private static final String PEER_SERVICE_LABEL = "peer_service";
    private static final String RPC_SERVICE_LABEL = "rpc_service";
    private static final String DB_SYSTEM_LABEL = "db_system";
    private static final String STATUS_LABEL = "http_response_status_code";
    private static final String GRPC_STATUS_LABEL = "rpc_grpc_status_code";

    /**
     * Get per-dependency metrics for a specific dependency edge.
     *
     * @param dependencyId the dependency UUID
     * @param start        range start
     * @param end          range end
     * @param stepSeconds  resolution step in seconds
     * @param rateWindow   PromQL rate window (e.g. "5m")
     */
    @Transactional(readOnly = true)
    public DependencyMetricsResponse getDependencyMetrics(UUID dependencyId,
                                                           Instant start, Instant end,
                                                           long stepSeconds, String rateWindow) {
        DependencyEntity dep = dependencyRepository.findById(dependencyId)
                .orElseThrow(() -> new ResourceNotFoundException("Dependency", dependencyId.toString()));

        String sourceServiceName = serviceRepository.findById(dep.getSourceServiceId())
                .map(ServiceEntity::getName).orElse("unknown");

        return buildMetricsResponse(dep, sourceServiceName, start, end, stepSeconds, rateWindow);
    }

    /**
     * Get metrics for all dependencies of a service.
     */
    @Transactional(readOnly = true)
    public List<DependencyMetricsResponse> getServiceDependencyMetrics(UUID serviceId,
                                                                        Instant start, Instant end,
                                                                        long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        List<DependencyEntity> deps = dependencyRepository.findBySourceServiceIdAndActiveTrue(serviceId);
        List<DependencyMetricsResponse> results = new ArrayList<>();

        for (DependencyEntity dep : deps) {
            results.add(buildMetricsResponse(dep, service.getName(), start, end, stepSeconds, rateWindow));
        }

        return results;
    }

    // ── Internal builders ──────────────────────────────────────────────────────

    private DependencyMetricsResponse buildMetricsResponse(DependencyEntity dep,
                                                            String sourceServiceName,
                                                            Instant start, Instant end,
                                                            long stepSeconds, String rateWindow) {
        String depType = dep.getDependencyType();

        // Select metric names and label strategy based on dependency type
        MetricConfig config = resolveMetricConfig(depType, sourceServiceName, dep);

        // Range queries for time-series
        TimeSeries latP50 = queryLatency(config, 0.50, rateWindow, start, end, stepSeconds, "latency_p50");
        TimeSeries latP95 = queryLatency(config, 0.95, rateWindow, start, end, stepSeconds, "latency_p95");
        TimeSeries latP99 = queryLatency(config, 0.99, rateWindow, start, end, stepSeconds, "latency_p99");
        TimeSeries errorRate = queryErrorRate(config, rateWindow, start, end, stepSeconds);
        TimeSeries throughput = queryThroughput(config, rateWindow, start, end, stepSeconds);

        // Instant values (current)
        InstantDependencyMetrics current = InstantDependencyMetrics.builder()
                .latencyP50(queryInstantLatency(config, 0.50, rateWindow))
                .latencyP95(queryInstantLatency(config, 0.95, rateWindow))
                .latencyP99(queryInstantLatency(config, 0.99, rateWindow))
                .errorRate(queryInstantErrorRate(config, rateWindow))
                .throughput(queryInstantThroughput(config, rateWindow))
                .callCount1h(dep.getCallCount1h())
                .errorCount1h(dep.getErrorCount1h())
                .avgLatencyMs1h(dep.getAvgLatencyMs1h())
                .build();

        return DependencyMetricsResponse.builder()
                .dependencyId(dep.getId())
                .sourceServiceName(sourceServiceName)
                .targetServiceName(dep.getTargetServiceName())
                .dependencyType(depType)
                .latencyP50(latP50)
                .latencyP95(latP95)
                .latencyP99(latP99)
                .errorRate(errorRate)
                .throughput(throughput)
                .current(current)
                .build();
    }

    /**
     * Resolve which Prometheus metric names and label filters to use based on dependency type.
     */
    private MetricConfig resolveMetricConfig(String depType, String sourceServiceName,
                                              DependencyEntity dep) {
        return switch (depType) {
            case "GRPC" -> new MetricConfig(
                    GRPC_CLIENT_DURATION_BUCKET,
                    GRPC_CLIENT_DURATION_COUNT,
                    SERVICE_LABEL, sourceServiceName,
                    RPC_SERVICE_LABEL, dep.getTargetServiceName(),
                    GRPC_STATUS_LABEL, "=~", "([^0]|[0-9]{2,})" // non-zero = error in gRPC
            );
            case "DATABASE" -> new MetricConfig(
                    DB_OPERATION_DURATION_BUCKET,
                    DB_OPERATION_DURATION_COUNT,
                    SERVICE_LABEL, sourceServiceName,
                    DB_SYSTEM_LABEL, dep.getDbSystem() != null ? dep.getDbSystem() : dep.getTargetServiceName(),
                    null, null, null // DB errors use a different signal (no status code label)
            );
            default -> new MetricConfig( // HTTP and CLOUD
                    HTTP_CLIENT_DURATION_BUCKET,
                    HTTP_CLIENT_DURATION_COUNT,
                    SERVICE_LABEL, sourceServiceName,
                    PEER_SERVICE_LABEL, dep.getTargetServiceName(),
                    STATUS_LABEL, "=~", "5.."
            );
        };
    }

    // ── PromQL query methods ───────────────────────────────────────────────────

    private TimeSeries queryLatency(MetricConfig config, double quantile, String rateWindow,
                                     Instant start, Instant end, long stepSeconds, String name) {
        String query = PromQLBuilder.metric(config.bucketMetric)
                .label(config.sourceLabel, config.sourceValue)
                .label(config.targetLabel, config.targetValue)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name(name)
                .labels(Map.of("source", config.sourceValue, "target", config.targetValue))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryErrorRate(MetricConfig config, String rateWindow,
                                       Instant start, Instant end, long stepSeconds) {
        if (config.errorLabel == null) {
            // DB dependencies: no standard error status label — return empty series
            return TimeSeries.builder()
                    .name("error_rate")
                    .labels(Map.of("source", config.sourceValue, "target", config.targetValue))
                    .dataPoints(Collections.emptyList())
                    .build();
        }

        String errors = PromQLBuilder.metric(config.countMetric)
                .label(config.sourceLabel, config.sourceValue)
                .label(config.targetLabel, config.targetValue)
                .label(config.errorLabel, config.errorOp, config.errorPattern)
                .rate(rateWindow)
                .sum()
                .build();

        String total = PromQLBuilder.metric(config.countMetric)
                .label(config.sourceLabel, config.sourceValue)
                .label(config.targetLabel, config.targetValue)
                .rate(rateWindow)
                .sum()
                .build();

        String query = errors + " / " + total;

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("error_rate")
                .labels(Map.of("source", config.sourceValue, "target", config.targetValue))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryThroughput(MetricConfig config, String rateWindow,
                                        Instant start, Instant end, long stepSeconds) {
        String query = PromQLBuilder.metric(config.countMetric)
                .label(config.sourceLabel, config.sourceValue)
                .label(config.targetLabel, config.targetValue)
                .rate(rateWindow)
                .sum()
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("throughput")
                .labels(Map.of("source", config.sourceValue, "target", config.targetValue))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    // ── Instant query helpers ──────────────────────────────────────────────────

    private Double queryInstantLatency(MetricConfig config, double quantile, String rateWindow) {
        String query = PromQLBuilder.metric(config.bucketMetric)
                .label(config.sourceLabel, config.sourceValue)
                .label(config.targetLabel, config.targetValue)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();

        return extractInstantValue(prometheusClient.query(query));
    }

    private Double queryInstantErrorRate(MetricConfig config, String rateWindow) {
        if (config.errorLabel == null) return null;

        String errors = PromQLBuilder.metric(config.countMetric)
                .label(config.sourceLabel, config.sourceValue)
                .label(config.targetLabel, config.targetValue)
                .label(config.errorLabel, config.errorOp, config.errorPattern)
                .rate(rateWindow)
                .sum()
                .build();

        String total = PromQLBuilder.metric(config.countMetric)
                .label(config.sourceLabel, config.sourceValue)
                .label(config.targetLabel, config.targetValue)
                .rate(rateWindow)
                .sum()
                .build();

        return extractInstantValue(prometheusClient.query(errors + " / " + total));
    }

    private Double queryInstantThroughput(MetricConfig config, String rateWindow) {
        String query = PromQLBuilder.metric(config.countMetric)
                .label(config.sourceLabel, config.sourceValue)
                .label(config.targetLabel, config.targetValue)
                .rate(rateWindow)
                .sum()
                .build();

        return extractInstantValue(prometheusClient.query(query));
    }

    // ── Response parsing ───────────────────────────────────────────────────────

    private List<MetricDataPoint> extractFirstSeries(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return Collections.emptyList();
        }

        PrometheusResponse.PromResult first = response.getData().getResult().getFirst();
        return parseDataPoints(first);
    }

    private List<MetricDataPoint> parseDataPoints(PrometheusResponse.PromResult result) {
        if (result.getValues() == null) return Collections.emptyList();

        List<MetricDataPoint> points = new ArrayList<>();
        for (List<Object> pair : result.getValues()) {
            if (pair.size() >= 2) {
                long ts = ((Number) pair.get(0)).longValue();
                double val = parseDouble(pair.get(1));
                if (!Double.isNaN(val)) {
                    points.add(new MetricDataPoint(ts, val));
                }
            }
        }
        return points;
    }

    private Double extractInstantValue(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return null;
        }
        PrometheusResponse.PromResult first = response.getData().getResult().getFirst();
        if (first.getValue() != null && first.getValue().size() >= 2) {
            double val = parseDouble(first.getValue().get(1));
            return Double.isNaN(val) ? null : val;
        }
        return null;
    }

    private double parseDouble(Object obj) {
        try {
            return Double.parseDouble(obj.toString());
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    // ── Internal config record ─────────────────────────────────────────────────

    /**
     * Holds the metric names and label configuration for a dependency type.
     */
    private record MetricConfig(
            String bucketMetric,
            String countMetric,
            String sourceLabel,
            String sourceValue,
            String targetLabel,
            String targetValue,
            String errorLabel,
            String errorOp,
            String errorPattern
    ) {}
}

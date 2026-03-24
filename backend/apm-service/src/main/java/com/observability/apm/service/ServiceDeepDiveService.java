package com.observability.apm.service;

import com.observability.apm.dto.ServiceDeepDiveResponse;
import com.observability.apm.dto.ServiceDeepDiveResponse.*;
import com.observability.apm.dto.TraceSearchResponse;
import com.observability.apm.elasticsearch.ElasticsearchLogClient;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import com.observability.apm.jaeger.JaegerResponse.JaegerProcess;
import com.observability.apm.jaeger.JaegerResponse.JaegerSpan;
import com.observability.apm.jaeger.JaegerResponse.JaegerTrace;
import com.observability.apm.prometheus.PromQLBuilder;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Story 8.2 — Service Deep Dive aggregation service.
 * Pulls data from Prometheus (metrics), Elasticsearch (logs), and Jaeger (traces)
 * to produce a unified health overview for a single service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceDeepDiveService {

    private static final String DURATION_METRIC = "http_server_request_duration_seconds_bucket";
    private static final String COUNT_METRIC = "http_server_request_duration_seconds_count";
    private static final String SERVICE_LABEL = "job";
    private static final String STATUS_LABEL = "http_response_status_code";

    private static final int MAX_ERROR_TRACES = 5;
    private static final int TRACE_SAMPLE_LIMIT = 100;

    private final ServiceRepository serviceRepository;
    private final PrometheusClient prometheusClient;
    private final ElasticsearchLogClient elasticsearchLogClient;
    private final JaegerClient jaegerClient;

    /**
     * Build a deep-dive response for a service.
     *
     * @param serviceId  service UUID
     * @param start      time range start
     * @param end        time range end
     * @param rateWindow PromQL rate window (e.g. "5m")
     * @return aggregated deep-dive response
     */
    public ServiceDeepDiveResponse getDeepDiveByName(String serviceName, Instant start, Instant end,
                                                      String rateWindow) {
        ServiceEntity service = serviceRepository.findByName(serviceName)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceName));
        return buildDeepDive(service, serviceName, start, end, rateWindow);
    }

    public ServiceDeepDiveResponse getDeepDive(UUID serviceId, Instant start, Instant end,
                                                String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();
        return buildDeepDive(service, serviceName, start, end, rateWindow);
    }

    private ServiceDeepDiveResponse buildDeepDive(ServiceEntity service, String serviceName,
                                                    Instant start, Instant end, String rateWindow) {

        // 1. Key metrics from Prometheus
        KeyMetrics keyMetrics = buildKeyMetrics(serviceName, rateWindow);

        // 2. Trace summary + recent error traces from Jaeger
        TraceSummary traceSummary = null;
        List<ErrorTraceSummary> recentErrors = List.of();
        if (service.isTracesEnabled()) {
            TraceAggregation agg = aggregateTraces(serviceName, start, end);
            traceSummary = agg.summary;
            recentErrors = agg.errors;
        }

        // 3. Log summary from Elasticsearch
        LogSummary logSummary = null;
        if (service.isLogsEnabled()) {
            logSummary = buildLogSummary(serviceName, start, end);
        }

        // 4. Compute health score
        double healthScore = computeHealthScore(keyMetrics, traceSummary, logSummary);
        String healthStatus = healthScore >= 0.9 ? "healthy"
                : healthScore >= 0.7 ? "degraded"
                : "unhealthy";

        return ServiceDeepDiveResponse.builder()
                .serviceId(service.getId().toString())
                .serviceName(serviceName)
                .environment(service.getEnvironment())
                .ownerTeam(service.getOwnerTeam())
                .tier(service.getTier())
                .metricsEnabled(service.isMetricsEnabled())
                .logsEnabled(service.isLogsEnabled())
                .tracesEnabled(service.isTracesEnabled())
                .healthScore(Math.round(healthScore * 1000.0) / 1000.0)
                .healthStatus(healthStatus)
                .keyMetrics(keyMetrics)
                .recentErrors(recentErrors)
                .logSummary(logSummary)
                .traceSummary(traceSummary)
                .build();
    }

    // ── Prometheus: key metrics ──────────────────────────────────────────────

    private KeyMetrics buildKeyMetrics(String serviceName, String rateWindow) {
        return KeyMetrics.builder()
                .latencyP50(queryInstantLatency(serviceName, 0.50, rateWindow))
                .latencyP95(queryInstantLatency(serviceName, 0.95, rateWindow))
                .latencyP99(queryInstantLatency(serviceName, 0.99, rateWindow))
                .errorRate(queryInstantErrorRate(serviceName, rateWindow))
                .requestRate(queryInstantRequestRate(serviceName, rateWindow))
                .build();
    }

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

    // ── Jaeger: trace summary + error traces ────────────────────────────────

    private record TraceAggregation(TraceSummary summary, List<ErrorTraceSummary> errors) {}

    private TraceAggregation aggregateTraces(String serviceName, Instant start, Instant end) {
        JaegerResponse response = jaegerClient.getTraces(
                serviceName, null, start, end, null, null, TRACE_SAMPLE_LIMIT, null);

        List<JaegerTrace> traces = response.getData() != null ? response.getData() : List.of();

        int traceCount = traces.size();
        int errorTraceCount = 0;
        long totalDuration = 0;
        List<ErrorTraceSummary> errors = new ArrayList<>();

        for (JaegerTrace trace : traces) {
            List<JaegerSpan> spans = trace.getSpans() != null ? trace.getSpans() : List.of();
            Map<String, JaegerProcess> processes = trace.getProcesses() != null ? trace.getProcesses() : Map.of();

            long minStart = spans.stream().mapToLong(JaegerSpan::getStartTime).min().orElse(0);
            long maxEnd = spans.stream().mapToLong(s -> s.getStartTime() + s.getDuration()).max().orElse(0);
            long duration = maxEnd - minStart;
            totalDuration += duration;

            int errCount = (int) spans.stream().filter(this::isErrorSpan).count();
            if (errCount > 0) {
                errorTraceCount++;

                if (errors.size() < MAX_ERROR_TRACES) {
                    // Find root span for operation name
                    JaegerSpan root = findRootSpan(spans);
                    String rootOp = root != null ? root.getOperationName() : "unknown";

                    errors.add(ErrorTraceSummary.builder()
                            .traceId(trace.getTraceId())
                            .rootOperation(rootOp)
                            .startTime(Instant.ofEpochSecond(
                                    minStart / 1_000_000L,
                                    (minStart % 1_000_000L) * 1_000L).toString())
                            .durationMicros(duration)
                            .errorCount(errCount)
                            .spanCount(spans.size())
                            .build());
                }
            }
        }

        long avgDuration = traceCount > 0 ? totalDuration / traceCount : 0;

        TraceSummary summary = TraceSummary.builder()
                .traceCount(traceCount)
                .errorTraceCount(errorTraceCount)
                .avgDurationMicros(avgDuration)
                .build();

        return new TraceAggregation(summary, errors);
    }

    // ── Elasticsearch: log summary ──────────────────────────────────────────

    private LogSummary buildLogSummary(String serviceName, Instant start, Instant end) {
        try {
            long totalLogs = elasticsearchLogClient.countTotalLogs(serviceName, start, end);
            long errorLogs = 0;

            if (totalLogs > 0) {
                // Count ERROR + FATAL logs
                var errorResult = elasticsearchLogClient.searchLogs(
                        serviceName, List.of("ERROR", "FATAL"), null, null,
                        start, end, 0, 0);
                errorLogs = errorResult.getTotalHits();
            }

            Double errorRatio = totalLogs > 0 ? (double) errorLogs / totalLogs : null;

            // Log enrichment coverage (average of traceId/spanId/serviceName)
            Double enrichmentScore = null;
            if (totalLogs > 0) {
                long withTraceId = elasticsearchLogClient.countLogsWithField(serviceName, "trace_id", start, end);
                long withSpanId = elasticsearchLogClient.countLogsWithField(serviceName, "span_id", start, end);
                long withService = elasticsearchLogClient.countLogsWithField(
                        serviceName, "resource.attributes.service.name", start, end);

                double traceRate = (double) withTraceId / totalLogs;
                double spanRate = (double) withSpanId / totalLogs;
                double svcRate = (double) withService / totalLogs;
                enrichmentScore = Math.round(((traceRate + spanRate + svcRate) / 3.0) * 10000.0) / 10000.0;
            }

            return LogSummary.builder()
                    .totalLogs(totalLogs)
                    .errorLogs(errorLogs)
                    .errorRatio(errorRatio != null ? Math.round(errorRatio * 10000.0) / 10000.0 : null)
                    .enrichmentScore(enrichmentScore)
                    .build();
        } catch (Exception e) {
            log.warn("Failed to build log summary for service {}: {}", serviceName, e.getMessage());
            return null;
        }
    }

    // ── Health score computation ─────────────────────────────────────────────

    /**
     * Compute a composite health score (0.0–1.0) from multiple signals.
     *
     * <p>Weighted components:
     * <ul>
     *   <li>Error rate (40%): 1.0 if error rate ≤ 1%, 0.0 if ≥ 10%, linear between</li>
     *   <li>Latency P95 (30%): 1.0 if ≤ 200ms, 0.0 if ≥ 2s, linear between</li>
     *   <li>Trace error ratio (15%): 1.0 if 0% error traces, 0.0 if ≥ 20%, linear</li>
     *   <li>Log error ratio (15%): 1.0 if error log ratio ≤ 1%, 0.0 if ≥ 10%, linear</li>
     * </ul>
     */
    private double computeHealthScore(KeyMetrics metrics, TraceSummary traceSummary, LogSummary logSummary) {
        double score = 0;
        double totalWeight = 0;

        // Error rate component (weight 0.4)
        if (metrics != null && metrics.getErrorRate() != null) {
            double errScore = linearScore(metrics.getErrorRate(), 0.01, 0.10);
            score += 0.4 * errScore;
            totalWeight += 0.4;
        }

        // Latency P95 component (weight 0.3)
        if (metrics != null && metrics.getLatencyP95() != null) {
            double latScore = linearScore(metrics.getLatencyP95(), 0.2, 2.0);
            score += 0.3 * latScore;
            totalWeight += 0.3;
        }

        // Trace error ratio component (weight 0.15)
        if (traceSummary != null && traceSummary.getTraceCount() > 0) {
            double traceErrRatio = (double) traceSummary.getErrorTraceCount() / traceSummary.getTraceCount();
            double traceScore = linearScore(traceErrRatio, 0.0, 0.20);
            score += 0.15 * traceScore;
            totalWeight += 0.15;
        }

        // Log error ratio component (weight 0.15)
        if (logSummary != null && logSummary.getErrorRatio() != null) {
            double logScore = linearScore(logSummary.getErrorRatio(), 0.01, 0.10);
            score += 0.15 * logScore;
            totalWeight += 0.15;
        }

        // Normalize: if no signals are available, return 1.0 (unknown → assume healthy)
        return totalWeight > 0 ? score / totalWeight : 1.0;
    }

    /**
     * Linear interpolation: 1.0 at good threshold, 0.0 at bad threshold.
     *
     * @param value   the observed value
     * @param goodMax the maximum value considered "good" (score 1.0)
     * @param badMax  the value at which score drops to 0.0
     * @return score between 0.0 and 1.0
     */
    private double linearScore(double value, double goodMax, double badMax) {
        if (value <= goodMax) return 1.0;
        if (value >= badMax) return 0.0;
        return 1.0 - (value - goodMax) / (badMax - goodMax);
    }

    // ── Shared helpers ──────────────────────────────────────────────────────

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

    private JaegerSpan findRootSpan(List<JaegerSpan> spans) {
        return spans.stream()
                .filter(s -> s.getReferences() == null || s.getReferences().isEmpty()
                        || s.getReferences().stream().noneMatch(r -> "CHILD_OF".equals(r.getRefType())))
                .min(Comparator.comparingLong(JaegerSpan::getStartTime))
                .orElseGet(() -> spans.stream()
                        .min(Comparator.comparingLong(JaegerSpan::getStartTime))
                        .orElse(null));
    }

    private boolean isErrorSpan(JaegerSpan span) {
        if (span.getTags() == null) return false;
        return span.getTags().stream()
                .anyMatch(t -> "error".equals(t.getKey()) && "true".equals(String.valueOf(t.getValue())));
    }
}

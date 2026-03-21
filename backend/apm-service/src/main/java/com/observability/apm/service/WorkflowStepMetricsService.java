package com.observability.apm.service;

import com.observability.apm.dto.WorkflowStepMetricsResponse;
import com.observability.apm.dto.WorkflowStepMetricsResponse.StepMetrics;
import com.observability.apm.entity.WorkflowEntity;
import com.observability.apm.entity.WorkflowStepEntity;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import com.observability.apm.jaeger.JaegerResponse.JaegerSpan;
import com.observability.apm.jaeger.JaegerResponse.JaegerTag;
import com.observability.apm.jaeger.JaegerResponse.JaegerTrace;
import com.observability.apm.prometheus.PromQLBuilder;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import com.observability.apm.repository.WorkflowRepository;
import com.observability.apm.repository.WorkflowStepRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Fetches live per-step metrics from Prometheus and Jaeger for a workflow.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WorkflowStepMetricsService {

    private static final String DURATION_METRIC = "http_server_request_duration_seconds_bucket";
    private static final String COUNT_METRIC = "http_server_request_duration_seconds_count";
    private static final String SERVICE_LABEL = "job";
    private static final String ROUTE_LABEL = "http_route";
    private static final String METHOD_LABEL = "http_request_method";
    private static final String STATUS_LABEL = "http_response_status_code";

    private final PrometheusClient prometheusClient;
    private final JaegerClient jaegerClient;
    private final WorkflowRepository workflowRepository;
    private final WorkflowStepRepository workflowStepRepository;

    /**
     * Get live metrics for each step in a workflow.
     *
     * @param workflowId  the workflow UUID
     * @param rateWindow  PromQL rate window (e.g. "5m")
     * @return per-step metrics response
     */
    public WorkflowStepMetricsResponse getStepMetrics(UUID workflowId, String rateWindow) {
        WorkflowEntity workflow = workflowRepository.findById(workflowId)
                .orElseThrow(() -> new ResourceNotFoundException("Workflow", workflowId.toString()));

        List<WorkflowStepEntity> steps = workflowStepRepository.findByWorkflowIdOrderByStepOrderAsc(workflowId);

        long rangeSeconds = parseRateWindowSeconds(rateWindow);
        Instant end = Instant.now();
        Instant start = end.minusSeconds(rangeSeconds);

        List<StepMetrics> stepMetricsList = new ArrayList<>();
        for (WorkflowStepEntity step : steps) {
            stepMetricsList.add(buildStepMetrics(step, rateWindow, start, end));
        }

        return WorkflowStepMetricsResponse.builder()
                .workflowId(workflowId)
                .workflowName(workflow.getName())
                .steps(stepMetricsList)
                .build();
    }

    private StepMetrics buildStepMetrics(WorkflowStepEntity step, String rateWindow,
                                         Instant start, Instant end) {
        String serviceName = step.getServiceName();
        String httpMethod = step.getHttpMethod();
        String pathPattern = step.getPathPattern();
        boolean isRegex = isRegexPattern(pathPattern);
        String routeOp = isRegex ? "=~" : "=";

        // Prometheus metrics — each wrapped in try/catch for graceful degradation
        Double requestRate = queryStepRequestRate(serviceName, httpMethod, pathPattern, routeOp, rateWindow);
        Double errorRate = queryStepErrorRate(serviceName, httpMethod, pathPattern, routeOp, rateWindow);
        Double latencyP50 = queryStepLatency(serviceName, httpMethod, pathPattern, routeOp, rateWindow, 0.50);
        Double latencyP95 = queryStepLatency(serviceName, httpMethod, pathPattern, routeOp, rateWindow, 0.95);
        Double latencyP99 = queryStepLatency(serviceName, httpMethod, pathPattern, routeOp, rateWindow, 0.99);

        // Jaeger traces
        Integer recentTraceCount = null;
        Integer recentErrorCount = null;
        try {
            String operation = isRegex ? null : httpMethod + " " + pathPattern;
            JaegerResponse jaegerResponse = jaegerClient.getTraces(
                    serviceName, operation, start, end, null, null, 20, null);

            if (jaegerResponse != null && jaegerResponse.getData() != null) {
                List<JaegerTrace> traces = jaegerResponse.getData();
                recentTraceCount = traces.size();
                recentErrorCount = countErrorTraces(traces);
            }
        } catch (Exception e) {
            log.warn("Jaeger query failed for step {} ({}): {}", step.getStepOrder(), serviceName, e.getMessage());
        }

        return StepMetrics.builder()
                .stepId(step.getId())
                .stepOrder(step.getStepOrder())
                .label(step.getLabel())
                .serviceName(serviceName)
                .httpMethod(httpMethod)
                .pathPattern(pathPattern)
                .requestRate(requestRate)
                .errorRate(errorRate)
                .latencyP50(latencyP50)
                .latencyP95(latencyP95)
                .latencyP99(latencyP99)
                .recentTraceCount(recentTraceCount)
                .recentErrorCount(recentErrorCount)
                .build();
    }

    // ── Prometheus per-step queries ──────────────────────────────────────────

    private Double queryStepRequestRate(String serviceName, String httpMethod,
                                        String pathPattern, String routeOp, String rateWindow) {
        try {
            String query = PromQLBuilder.metric(COUNT_METRIC)
                    .label(SERVICE_LABEL, serviceName)
                    .label(ROUTE_LABEL, routeOp, pathPattern)
                    .label(METHOD_LABEL, httpMethod.toUpperCase())
                    .rate(rateWindow)
                    .sum()
                    .build();
            return extractInstantValue(prometheusClient.query(query));
        } catch (Exception e) {
            log.warn("Prometheus request rate query failed for {}: {}", serviceName, e.getMessage());
            return null;
        }
    }

    private Double queryStepErrorRate(String serviceName, String httpMethod,
                                      String pathPattern, String routeOp, String rateWindow) {
        try {
            String errors = PromQLBuilder.metric(COUNT_METRIC)
                    .label(SERVICE_LABEL, serviceName)
                    .label(ROUTE_LABEL, routeOp, pathPattern)
                    .label(METHOD_LABEL, httpMethod.toUpperCase())
                    .label(STATUS_LABEL, "=~", "5..")
                    .rate(rateWindow)
                    .sum()
                    .build();

            String total = PromQLBuilder.metric(COUNT_METRIC)
                    .label(SERVICE_LABEL, serviceName)
                    .label(ROUTE_LABEL, routeOp, pathPattern)
                    .label(METHOD_LABEL, httpMethod.toUpperCase())
                    .rate(rateWindow)
                    .sum()
                    .build();

            return extractInstantValue(prometheusClient.query(errors + " / " + total));
        } catch (Exception e) {
            log.warn("Prometheus error rate query failed for {}: {}", serviceName, e.getMessage());
            return null;
        }
    }

    private Double queryStepLatency(String serviceName, String httpMethod,
                                    String pathPattern, String routeOp,
                                    String rateWindow, double quantile) {
        try {
            String query = PromQLBuilder.metric(DURATION_METRIC)
                    .label(SERVICE_LABEL, serviceName)
                    .label(ROUTE_LABEL, routeOp, pathPattern)
                    .label(METHOD_LABEL, httpMethod.toUpperCase())
                    .rate(rateWindow)
                    .sumBy("le")
                    .histogramQuantile(quantile)
                    .build();
            return extractInstantValue(prometheusClient.query(query));
        } catch (Exception e) {
            log.warn("Prometheus latency query failed for {}: {}", serviceName, e.getMessage());
            return null;
        }
    }

    // ── Jaeger helpers ───────────────────────────────────────────────────────

    private int countErrorTraces(List<JaegerTrace> traces) {
        int errorCount = 0;
        for (JaegerTrace trace : traces) {
            if (trace.getSpans() == null) continue;
            boolean hasError = trace.getSpans().stream().anyMatch(this::isErrorSpan);
            if (hasError) errorCount++;
        }
        return errorCount;
    }

    private boolean isErrorSpan(JaegerSpan span) {
        if (span.getTags() == null) return false;
        Map<String, String> tags = span.getTags().stream()
                .filter(t -> t.getKey() != null && t.getValue() != null)
                .collect(Collectors.toMap(
                        JaegerTag::getKey,
                        t -> String.valueOf(t.getValue()),
                        (v1, v2) -> v2));

        // error=true tag
        if ("true".equalsIgnoreCase(tags.get("error"))) return true;

        // HTTP status >= 500
        String statusStr = tags.get("http.status_code");
        if (statusStr == null) statusStr = tags.get("http_response_status_code");
        if (statusStr != null) {
            try {
                return Integer.parseInt(statusStr) >= 500;
            } catch (NumberFormatException ignored) {}
        }

        return false;
    }

    // ── Prometheus response parsing ──────────────────────────────────────────

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

    // ── Regex detection (mirrors WorkflowCorrelationService.matchPath) ──────

    private boolean isRegexPattern(String pattern) {
        if (pattern == null) return false;
        return pattern.startsWith("^")
                || pattern.contains(".*")
                || pattern.contains(".+")
                || pattern.contains("\\d")
                || pattern.contains("[");
    }

    /** Parse a PromQL rate window string (e.g. "5m", "1h", "30s") to seconds. */
    private long parseRateWindowSeconds(String rateWindow) {
        if (rateWindow == null || rateWindow.isBlank()) return 300;
        try {
            String numPart = rateWindow.substring(0, rateWindow.length() - 1);
            char unit = rateWindow.charAt(rateWindow.length() - 1);
            long num = Long.parseLong(numPart);
            return switch (unit) {
                case 's' -> num;
                case 'm' -> num * 60;
                case 'h' -> num * 3600;
                case 'd' -> num * 86400;
                default -> 300;
            };
        } catch (Exception e) {
            return 300;
        }
    }
}

package com.observability.report.prometheus;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.report.config.PrometheusClientConfig;
import com.observability.report.dto.PerformanceReportData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Queries Prometheus for metrics data used in report generation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PrometheusQueryService {

    private final PrometheusClientConfig config;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    /**
     * Query latency percentiles (p50, p95, p99) for a service over a time range.
     */
    public PerformanceReportData.LatencySummary queryLatencySummary(String serviceName,
                                                                    Instant start,
                                                                    Instant end) {
        try {
            double p50 = queryScalar(
                    String.format("histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"%s\"}[5m])) by (le))", serviceName),
                    end) * 1000;
            double p95 = queryScalar(
                    String.format("histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"%s\"}[5m])) by (le))", serviceName),
                    end) * 1000;
            double p99 = queryScalar(
                    String.format("histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"%s\"}[5m])) by (le))", serviceName),
                    end) * 1000;
            double avg = queryScalar(
                    String.format("sum(rate(http_server_request_duration_seconds_sum{service_name=\"%s\"}[5m])) / sum(rate(http_server_request_duration_seconds_count{service_name=\"%s\"}[5m]))", serviceName, serviceName),
                    end) * 1000;

            return PerformanceReportData.LatencySummary.builder()
                    .p50Ms(p50)
                    .p95Ms(p95)
                    .p99Ms(p99)
                    .avgMs(avg)
                    .build();
        } catch (Exception e) {
            log.warn("Failed to query latency summary for service {}: {}", serviceName, e.getMessage());
            return PerformanceReportData.LatencySummary.builder()
                    .p50Ms(0).p95Ms(0).p99Ms(0).avgMs(0).build();
        }
    }

    /**
     * Query throughput summary for a service.
     */
    public PerformanceReportData.ThroughputSummary queryThroughputSummary(String serviceName,
                                                                          Instant start,
                                                                          Instant end) {
        try {
            double avgRps = queryScalar(
                    String.format("sum(rate(http_server_request_duration_seconds_count{service_name=\"%s\"}[5m]))", serviceName),
                    end);
            double peakRps = queryScalar(
                    String.format("max_over_time(sum(rate(http_server_request_duration_seconds_count{service_name=\"%s\"}[5m]))[%ds:])",
                            serviceName, durationSeconds(start, end)),
                    end);
            long totalRequests = (long) queryScalar(
                    String.format("sum(increase(http_server_request_duration_seconds_count{service_name=\"%s\"}[%ds]))",
                            serviceName, durationSeconds(start, end)),
                    end);

            return PerformanceReportData.ThroughputSummary.builder()
                    .avgRequestsPerSecond(avgRps)
                    .peakRequestsPerSecond(peakRps)
                    .totalRequests(totalRequests)
                    .build();
        } catch (Exception e) {
            log.warn("Failed to query throughput summary for service {}: {}", serviceName, e.getMessage());
            return PerformanceReportData.ThroughputSummary.builder()
                    .avgRequestsPerSecond(0).peakRequestsPerSecond(0).totalRequests(0).build();
        }
    }

    /**
     * Query error budget for a service.
     */
    public PerformanceReportData.ErrorBudgetSummary queryErrorBudget(String serviceName,
                                                                     Instant start,
                                                                     Instant end) {
        try {
            long totalRequests = (long) queryScalar(
                    String.format("sum(increase(http_server_request_duration_seconds_count{service_name=\"%s\"}[%ds]))",
                            serviceName, durationSeconds(start, end)),
                    end);
            long totalErrors = (long) queryScalar(
                    String.format("sum(increase(http_server_request_duration_seconds_count{service_name=\"%s\",http_status_code=~\"5..\"}[%ds]))",
                            serviceName, durationSeconds(start, end)),
                    end);
            double errorRate = totalRequests > 0 ? (double) totalErrors / totalRequests * 100 : 0;
            double errorBudgetRemaining = Math.max(0, 100 - errorRate);

            return PerformanceReportData.ErrorBudgetSummary.builder()
                    .errorRatePct(errorRate)
                    .errorBudgetRemainingPct(errorBudgetRemaining)
                    .totalErrors(totalErrors)
                    .totalRequests(totalRequests)
                    .build();
        } catch (Exception e) {
            log.warn("Failed to query error budget for service {}: {}", serviceName, e.getMessage());
            return PerformanceReportData.ErrorBudgetSummary.builder()
                    .errorRatePct(0).errorBudgetRemainingPct(100).totalErrors(0).totalRequests(0).build();
        }
    }

    /**
     * Query infrastructure utilisation for a service.
     */
    public PerformanceReportData.InfraUtilisation queryInfraUtilisation(String serviceName,
                                                                        Instant start,
                                                                        Instant end) {
        try {
            double avgCpu = queryScalar(
                    String.format("avg(avg_over_time(container_cpu_usage_percent{service_name=\"%s\"}[%ds]))",
                            serviceName, durationSeconds(start, end)),
                    end);
            double peakCpu = queryScalar(
                    String.format("max(max_over_time(container_cpu_usage_percent{service_name=\"%s\"}[%ds]))",
                            serviceName, durationSeconds(start, end)),
                    end);
            double avgMem = queryScalar(
                    String.format("avg(avg_over_time(container_memory_usage_percent{service_name=\"%s\"}[%ds]))",
                            serviceName, durationSeconds(start, end)),
                    end);
            double peakMem = queryScalar(
                    String.format("max(max_over_time(container_memory_usage_percent{service_name=\"%s\"}[%ds]))",
                            serviceName, durationSeconds(start, end)),
                    end);

            return PerformanceReportData.InfraUtilisation.builder()
                    .avgCpuPct(avgCpu).peakCpuPct(peakCpu)
                    .avgMemoryPct(avgMem).peakMemoryPct(peakMem)
                    .avgDiskIoPct(0).avgNetworkMbps(0)
                    .build();
        } catch (Exception e) {
            log.warn("Failed to query infra utilisation for service {}: {}", serviceName, e.getMessage());
            return PerformanceReportData.InfraUtilisation.builder().build();
        }
    }

    /**
     * Query latency trends over time (bucketed by step).
     */
    public List<PerformanceReportData.LatencyTrend> queryLatencyTrends(String serviceName,
                                                                       Instant start,
                                                                       Instant end,
                                                                       String step) {
        List<PerformanceReportData.LatencyTrend> trends = new ArrayList<>();
        try {
            List<double[]> p50Data = queryRange(
                    String.format("histogram_quantile(0.50, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"%s\"}[5m])) by (le))", serviceName),
                    start, end, step);
            List<double[]> p95Data = queryRange(
                    String.format("histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"%s\"}[5m])) by (le))", serviceName),
                    start, end, step);
            List<double[]> p99Data = queryRange(
                    String.format("histogram_quantile(0.99, sum(rate(http_server_request_duration_seconds_bucket{service_name=\"%s\"}[5m])) by (le))", serviceName),
                    start, end, step);

            for (int i = 0; i < p50Data.size(); i++) {
                String ts = Instant.ofEpochSecond((long) p50Data.get(i)[0])
                        .atOffset(ZoneOffset.UTC)
                        .format(DateTimeFormatter.ISO_DATE_TIME);
                trends.add(PerformanceReportData.LatencyTrend.builder()
                        .timestamp(ts)
                        .p50Ms(p50Data.get(i)[1] * 1000)
                        .p95Ms(i < p95Data.size() ? p95Data.get(i)[1] * 1000 : 0)
                        .p99Ms(i < p99Data.size() ? p99Data.get(i)[1] * 1000 : 0)
                        .build());
            }
        } catch (Exception e) {
            log.warn("Failed to query latency trends for service {}: {}", serviceName, e.getMessage());
        }
        return trends;
    }

    /**
     * Query throughput trends over time.
     */
    public List<PerformanceReportData.ThroughputTrend> queryThroughputTrends(String serviceName,
                                                                              Instant start,
                                                                              Instant end,
                                                                              String step) {
        List<PerformanceReportData.ThroughputTrend> trends = new ArrayList<>();
        try {
            List<double[]> rpsData = queryRange(
                    String.format("sum(rate(http_server_request_duration_seconds_count{service_name=\"%s\"}[5m]))", serviceName),
                    start, end, step);
            List<double[]> errorData = queryRange(
                    String.format("sum(rate(http_server_request_duration_seconds_count{service_name=\"%s\",http_status_code=~\"5..\"}[5m])) / sum(rate(http_server_request_duration_seconds_count{service_name=\"%s\"}[5m])) * 100",
                            serviceName, serviceName),
                    start, end, step);

            for (int i = 0; i < rpsData.size(); i++) {
                String ts = Instant.ofEpochSecond((long) rpsData.get(i)[0])
                        .atOffset(ZoneOffset.UTC)
                        .format(DateTimeFormatter.ISO_DATE_TIME);
                trends.add(PerformanceReportData.ThroughputTrend.builder()
                        .timestamp(ts)
                        .requestsPerSecond(rpsData.get(i)[1])
                        .errorRate(i < errorData.size() ? errorData.get(i)[1] : 0)
                        .build());
            }
        } catch (Exception e) {
            log.warn("Failed to query throughput trends for service {}: {}", serviceName, e.getMessage());
        }
        return trends;
    }

    /**
     * Execute an instant PromQL query and return a scalar value.
     */
    private double queryScalar(String query, Instant time) {
        URI uri = UriComponentsBuilder.fromHttpUrl(config.getUrl())
                .path("/api/v1/query")
                .queryParam("query", query)
                .queryParam("time", time.getEpochSecond())
                .build()
                .encode()
                .toUri();

        String response = restTemplate.getForObject(uri, String.class);
        return parseScalarResult(response);
    }

    /**
     * Execute a range PromQL query and return [timestamp, value] pairs.
     */
    private List<double[]> queryRange(String query, Instant start, Instant end, String step) {
        URI uri = UriComponentsBuilder.fromHttpUrl(config.getUrl())
                .path("/api/v1/query_range")
                .queryParam("query", query)
                .queryParam("start", start.getEpochSecond())
                .queryParam("end", end.getEpochSecond())
                .queryParam("step", step)
                .build()
                .encode()
                .toUri();

        String response = restTemplate.getForObject(uri, String.class);
        return parseRangeResult(response);
    }

    private double parseScalarResult(String response) {
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode result = root.path("data").path("result");
            if (result.isArray() && !result.isEmpty()) {
                JsonNode value = result.get(0).path("value");
                if (value.isArray() && value.size() >= 2) {
                    String val = value.get(1).asText();
                    if ("NaN".equals(val) || "+Inf".equals(val) || "-Inf".equals(val)) {
                        return 0;
                    }
                    return Double.parseDouble(val);
                }
            }
        } catch (Exception e) {
            log.debug("Failed to parse Prometheus scalar result: {}", e.getMessage());
        }
        return 0;
    }

    private List<double[]> parseRangeResult(String response) {
        List<double[]> results = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(response);
            JsonNode result = root.path("data").path("result");
            if (result.isArray() && !result.isEmpty()) {
                JsonNode values = result.get(0).path("values");
                if (values.isArray()) {
                    for (JsonNode point : values) {
                        double timestamp = point.get(0).asDouble();
                        String val = point.get(1).asText();
                        double value = ("NaN".equals(val) || "+Inf".equals(val) || "-Inf".equals(val))
                                ? 0 : Double.parseDouble(val);
                        results.add(new double[]{timestamp, value});
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Failed to parse Prometheus range result: {}", e.getMessage());
        }
        return results;
    }

    private long durationSeconds(Instant start, Instant end) {
        return Math.max(1, end.getEpochSecond() - start.getEpochSecond());
    }
}

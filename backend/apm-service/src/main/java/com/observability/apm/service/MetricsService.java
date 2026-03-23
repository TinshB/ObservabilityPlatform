package com.observability.apm.service;

import com.observability.apm.dto.ApiMetricsResponse;
import com.observability.apm.dto.InfraMetricsResponse;
import com.observability.apm.dto.MetricDataPoint;
import com.observability.apm.dto.ServiceMetricsResponse;
import com.observability.apm.dto.ServiceMetricsResponse.InstantMetrics;
import com.observability.apm.dto.TimeSeries;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.prometheus.PromQLBuilder;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Metrics query service that builds PromQL expressions and queries Prometheus.
 *
 * <p>Uses standard OTel metric names:
 * <ul>
 *   <li>{@code http_server_request_duration_seconds} — histogram for request latency</li>
 *   <li>{@code http_server_request_duration_seconds_count} — counter for request count</li>
 * </ul>
 *
 * <p>Label conventions (OTel semantic conventions):
 * <ul>
 *   <li>{@code service_name} — the service producing the metric</li>
 *   <li>{@code http_route} — the matched HTTP route pattern (e.g. /api/v1/users)</li>
 *   <li>{@code http_response_status_code} — HTTP response status code</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MetricsService {

    private static final String DURATION_METRIC = "http_server_request_duration_seconds_bucket";
    private static final String COUNT_METRIC = "http_server_request_duration_seconds_count";
    private static final String SERVICE_LABEL = "job";
    private static final String ROUTE_LABEL = "http_route";
    private static final String STATUS_LABEL = "http_response_status_code";

    private final PrometheusClient prometheusClient;
    private final ServiceRepository serviceRepository;

    // ── Story 5.1: Service-Level Metrics ────────────────────────────────────────

    /**
     * Fetch service-level metrics: latency (P50/P95/P99), error rate, and RPS.
     *
     * @param serviceId   the service UUID
     * @param start       range start
     * @param end         range end
     * @param stepSeconds resolution step in seconds
     * @param rateWindow  PromQL rate window (e.g. "5m")
     */
    public ServiceMetricsResponse getServiceMetrics(UUID serviceId, Instant start, Instant end,
                                                     long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();

        // Build range queries
        TimeSeries latP50 = queryLatencyPercentile(serviceName, 0.50, rateWindow, start, end, stepSeconds, "latency_p50");
        TimeSeries latP95 = queryLatencyPercentile(serviceName, 0.95, rateWindow, start, end, stepSeconds, "latency_p95");
        TimeSeries latP99 = queryLatencyPercentile(serviceName, 0.99, rateWindow, start, end, stepSeconds, "latency_p99");
        TimeSeries errRate = queryErrorRate(serviceName, rateWindow, start, end, stepSeconds);
        TimeSeries rps = queryRequestRate(serviceName, rateWindow, start, end, stepSeconds);
        long totalRequests = queryTotalRequestCount(serviceName, start, end);

        // Build instant queries for current values
        ServiceMetricsResponse.InstantMetrics current = ServiceMetricsResponse.InstantMetrics.builder()
                .latencyP50(queryInstantLatency(serviceName, 0.50, rateWindow))
                .latencyP95(queryInstantLatency(serviceName, 0.95, rateWindow))
                .latencyP99(queryInstantLatency(serviceName, 0.99, rateWindow))
                .errorRate(queryInstantErrorRate(serviceName, rateWindow))
                .requestRate(queryInstantRequestRate(serviceName, rateWindow))
                .build();

        return ServiceMetricsResponse.builder()
                .serviceName(serviceName)
                .latencyP50(latP50)
                .latencyP95(latP95)
                .latencyP99(latP99)
                .errorRate(errRate)
                .requestRate(rps)
                .totalRequestCount(totalRequests)
                .current(current)
                .build();
    }

    // ── Story 9.1: Instant metrics by service name (for correlation) ────────────

    /**
     * Get instant metrics for a service by name (no UUID lookup required).
     * Used by {@link CorrelationService} for cross-signal correlation.
     *
     * @param serviceName the service name
     * @param rateWindow  PromQL rate window (e.g. "5m")
     * @return instant metrics snapshot
     */
    @Cacheable(value = "metrics-instant", key = "#serviceName + ':' + #rateWindow")
    public InstantMetrics getInstantMetricsForService(String serviceName, String rateWindow) {
        return InstantMetrics.builder()
                .latencyP50(queryInstantLatency(serviceName, 0.50, rateWindow))
                .latencyP95(queryInstantLatency(serviceName, 0.95, rateWindow))
                .latencyP99(queryInstantLatency(serviceName, 0.99, rateWindow))
                .errorRate(queryInstantErrorRate(serviceName, rateWindow))
                .requestRate(queryInstantRequestRate(serviceName, rateWindow))
                .build();
    }

    // ── Story 5.2: API-Level Metrics ────────────────────────────────────────────

    /**
     * Fetch API-level metrics: per-route latency histograms and status code distribution.
     *
     * @param serviceId   the service UUID
     * @param start       range start
     * @param end         range end
     * @param stepSeconds resolution step in seconds
     * @param rateWindow  PromQL rate window (e.g. "5m")
     */
    public ApiMetricsResponse getApiMetrics(UUID serviceId, Instant start, Instant end,
                                             long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();

        // Per-route latency histograms
        List<TimeSeries> p50ByRoute = queryLatencyByRoute(serviceName, 0.50, rateWindow, start, end, stepSeconds, "latency_p50");
        List<TimeSeries> p95ByRoute = queryLatencyByRoute(serviceName, 0.95, rateWindow, start, end, stepSeconds, "latency_p95");
        List<TimeSeries> p99ByRoute = queryLatencyByRoute(serviceName, 0.99, rateWindow, start, end, stepSeconds, "latency_p99");

        // Per-route throughput
        List<TimeSeries> throughput = queryThroughputByRoute(serviceName, rateWindow, start, end, stepSeconds);

        // Status code distribution (instant query)
        List<ApiMetricsResponse.StatusCodeGroup> statusDist = queryStatusCodeDistribution(serviceName, rateWindow);

        return ApiMetricsResponse.builder()
                .serviceName(serviceName)
                .latencyP50ByRoute(p50ByRoute)
                .latencyP95ByRoute(p95ByRoute)
                .latencyP99ByRoute(p99ByRoute)
                .throughputByRoute(throughput)
                .statusCodeDistribution(statusDist)
                .build();
    }

    // ── Service-level PromQL builders ───────────────────────────────────────────

    private TimeSeries queryLatencyPercentile(String serviceName, double quantile,
                                              String rateWindow, Instant start, Instant end,
                                              long stepSeconds, String seriesName) {
        String query = PromQLBuilder.metric(DURATION_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le")
                .histogramQuantile(quantile)
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        List<MetricDataPoint> points = extractFirstSeries(response);

        return TimeSeries.builder()
                .name(seriesName)
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(points)
                .build();
    }

    private TimeSeries queryErrorRate(String serviceName, String rateWindow,
                                       Instant start, Instant end, long stepSeconds) {
        // error_rate = sum(rate(count{5xx})) / sum(rate(count{all}))
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

        String query = errors + " / " + total;

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        List<MetricDataPoint> points = extractFirstSeries(response);

        return TimeSeries.builder()
                .name("error_rate")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(points)
                .build();
    }

    private TimeSeries queryRequestRate(String serviceName, String rateWindow,
                                         Instant start, Instant end, long stepSeconds) {
        String query = PromQLBuilder.metric(COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        List<MetricDataPoint> points = extractFirstSeries(response);

        return TimeSeries.builder()
                .name("request_rate")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(points)
                .build();
    }

    private long queryTotalRequestCount(String serviceName, Instant start, Instant end) {
        // increase(count_total{service}[range]) gives the total count over the window.
        // We compute: sum(count @ end) - sum(count @ start)
        String inner = PromQLBuilder.metric(COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .build();
        String queryEnd = "sum(" + inner + ")";

        Double valEnd = extractInstantValue(prometheusClient.query(queryEnd, end));
        Double valStart = extractInstantValue(prometheusClient.query(queryEnd, start));

        if (valEnd == null) return 0L;
        if (valStart == null) return Math.round(valEnd);
        return Math.max(0L, Math.round(valEnd - valStart));
    }

    // ── Instant query helpers ───────────────────────────────────────────────────

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

    // ── API-level PromQL builders ───────────────────────────────────────────────

    private List<TimeSeries> queryLatencyByRoute(String serviceName, double quantile,
                                                  String rateWindow, Instant start, Instant end,
                                                  long stepSeconds, String seriesName) {
        // histogram_quantile(q, sum by(le, http_route)(rate(bucket{service}[window])))
        String query = PromQLBuilder.metric(DURATION_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("le", ROUTE_LABEL)
                .histogramQuantile(quantile)
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return extractMultiSeries(response, seriesName);
    }

    private List<TimeSeries> queryThroughputByRoute(String serviceName, String rateWindow,
                                                     Instant start, Instant end, long stepSeconds) {
        String query = PromQLBuilder.metric(COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy(ROUTE_LABEL)
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return extractMultiSeries(response, "throughput");
    }

    private List<ApiMetricsResponse.StatusCodeGroup> queryStatusCodeDistribution(
            String serviceName, String rateWindow) {
        // sum by(http_route, http_response_status_code)(rate(count{service}[window]))
        String query = PromQLBuilder.metric(COUNT_METRIC)
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy(ROUTE_LABEL, STATUS_LABEL)
                .build();

        PrometheusResponse response = prometheusClient.query(query);
        List<ApiMetricsResponse.StatusCodeGroup> groups = new ArrayList<>();

        if (response != null && response.getData() != null && response.getData().getResult() != null) {
            for (PrometheusResponse.PromResult result : response.getData().getResult()) {
                Map<String, String> labels = result.getMetric();
                Double value = parseInstantValue(result);
                if (value != null && labels != null) {
                    groups.add(ApiMetricsResponse.StatusCodeGroup.builder()
                            .httpRoute(labels.getOrDefault(ROUTE_LABEL, "unknown"))
                            .statusCode(labels.getOrDefault(STATUS_LABEL, "unknown"))
                            .requestCount(value)
                            .build());
                }
            }
        }

        return groups;
    }

    // ── Story 5.3: Infra-Level Metrics ─────────────────────────────────────────

    /**
     * Fetch infra-level metrics: CPU, JVM memory, threads, classes, and GC.
     * Uses OTel/Micrometer service-level metrics filtered by {@code job=<serviceName>}.
     *
     * @param serviceId   the service UUID
     * @param start       range start
     * @param end         range end
     * @param stepSeconds resolution step in seconds
     * @param rateWindow  PromQL rate window (e.g. "5m")
     */
    public InfraMetricsResponse getInfraMetrics(UUID serviceId, Instant start, Instant end,
                                                 long stepSeconds, String rateWindow) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        String serviceName = service.getName();

        // CPU — OTel/Micrometer
        TimeSeries processCpu = queryProcessCpuUsage(serviceName, rateWindow, start, end, stepSeconds);
        TimeSeries systemCpu = querySystemCpuUsage(serviceName, start, end, stepSeconds);
        List<TimeSeries> cpuByInstance = queryProcessCpuByInstance(serviceName, rateWindow, start, end, stepSeconds);

        // JVM Memory — Micrometer
        TimeSeries heapUsed = queryJvmMemory(serviceName, "heap", "used", start, end, stepSeconds);
        TimeSeries heapCommitted = queryJvmMemory(serviceName, "heap", "committed", start, end, stepSeconds);
        TimeSeries heapMax = queryJvmMemory(serviceName, "heap", "max", start, end, stepSeconds);
        TimeSeries nonHeapUsed = queryJvmMemory(serviceName, "nonheap", "used", start, end, stepSeconds);
        TimeSeries nonHeapCommitted = queryJvmMemory(serviceName, "nonheap", "committed", start, end, stepSeconds);
        TimeSeries processRss = queryProcessResidentMemory(serviceName, start, end, stepSeconds);
        List<TimeSeries> heapByInstance = queryJvmMemoryHeapByInstance(serviceName, start, end, stepSeconds);

        // Threads — Micrometer
        TimeSeries threadsLive = queryJvmThreads(serviceName, "jvm_threads_live_threads", start, end, stepSeconds);
        TimeSeries threadsDaemon = queryJvmThreads(serviceName, "jvm_threads_daemon_threads", start, end, stepSeconds);

        // Classes — Micrometer
        TimeSeries classesLoaded = queryJvmClasses(serviceName, start, end, stepSeconds);

        // JVM GC pause — OTel/Micrometer
        TimeSeries gcPause = queryGcPauseTime(serviceName, rateWindow, start, end, stepSeconds);
        TimeSeries gcCount = queryGcPauseCount(serviceName, rateWindow, start, end, stepSeconds);

        // Current instant values
        InfraMetricsResponse.InstantInfraMetrics current = buildInstantInfraMetrics(serviceName, rateWindow);

        return InfraMetricsResponse.builder()
                .serviceName(serviceName)
                .processCpuUsage(processCpu)
                .systemCpuUsage(systemCpu)
                .processCpuByInstance(cpuByInstance)
                .jvmMemoryHeapUsed(heapUsed)
                .jvmMemoryHeapCommitted(heapCommitted)
                .jvmMemoryHeapMax(heapMax)
                .jvmMemoryNonHeapUsed(nonHeapUsed)
                .jvmMemoryNonHeapCommitted(nonHeapCommitted)
                .processResidentMemory(processRss)
                .jvmMemoryHeapByInstance(heapByInstance)
                .jvmThreadsLive(threadsLive)
                .jvmThreadsDaemon(threadsDaemon)
                .jvmClassesLoaded(classesLoaded)
                .gcPauseTime(gcPause)
                .gcPauseCount(gcCount)
                .current(current)
                .build();
    }

    // ── Infra-level PromQL builders ─────────────────────────────────────────────

    private TimeSeries queryProcessCpuUsage(String serviceName, String rateWindow,
                                             Instant start, Instant end, long stepSeconds) {
        String query = PromQLBuilder.metric("process_cpu_seconds_total")
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("process_cpu_usage")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private List<TimeSeries> queryProcessCpuByInstance(String serviceName, String rateWindow,
                                                        Instant start, Instant end, long stepSeconds) {
        String query = PromQLBuilder.metric("process_cpu_seconds_total")
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sumBy("instance")
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return extractMultiSeries(response, "process_cpu_by_instance");
    }

    private TimeSeries querySystemCpuUsage(String serviceName,
                                            Instant start, Instant end, long stepSeconds) {
        String inner = PromQLBuilder.metric("system_cpu_usage")
                .label(SERVICE_LABEL, serviceName)
                .build();
        String query = "avg(" + inner + ")";

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("system_cpu_usage")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryJvmMemory(String serviceName, String area, String stat,
                                       Instant start, Instant end, long stepSeconds) {
        String inner = PromQLBuilder.metric("jvm_memory_" + stat + "_bytes")
                .label(SERVICE_LABEL, serviceName)
                .label("area", area)
                .build();
        String query = "sum(" + inner + ")";

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("jvm_memory_" + area + "_" + stat)
                .labels(Map.of(SERVICE_LABEL, serviceName, "area", area))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private List<TimeSeries> queryJvmMemoryHeapByInstance(String serviceName,
                                                           Instant start, Instant end, long stepSeconds) {
        String inner = PromQLBuilder.metric("jvm_memory_used_bytes")
                .label(SERVICE_LABEL, serviceName)
                .label("area", "heap")
                .build();
        String query = "sum by(instance)(" + inner + ")";

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return extractMultiSeries(response, "jvm_memory_heap_by_instance");
    }

    private TimeSeries queryProcessResidentMemory(String serviceName,
                                                    Instant start, Instant end, long stepSeconds) {
        String inner = PromQLBuilder.metric("process_resident_memory_bytes")
                .label(SERVICE_LABEL, serviceName)
                .build();
        String query = "sum(" + inner + ")";

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("process_resident_memory")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryJvmThreads(String serviceName, String metric,
                                        Instant start, Instant end, long stepSeconds) {
        String inner = PromQLBuilder.metric(metric)
                .label(SERVICE_LABEL, serviceName)
                .build();
        String query = "sum(" + inner + ")";

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name(metric)
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryJvmClasses(String serviceName,
                                        Instant start, Instant end, long stepSeconds) {
        String inner = PromQLBuilder.metric("jvm_classes_loaded_classes")
                .label(SERVICE_LABEL, serviceName)
                .build();
        String query = "sum(" + inner + ")";

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("jvm_classes_loaded")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryGcPauseTime(String serviceName, String rateWindow,
                                         Instant start, Instant end, long stepSeconds) {
        // rate(jvm_gc_pause_seconds_sum{service_name="..."}[5m])
        String query = PromQLBuilder.metric("jvm_gc_pause_seconds_sum")
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("gc_pause_time")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private TimeSeries queryGcPauseCount(String serviceName, String rateWindow,
                                          Instant start, Instant end, long stepSeconds) {
        // rate(jvm_gc_pause_seconds_count{service_name="..."}[5m])
        String query = PromQLBuilder.metric("jvm_gc_pause_seconds_count")
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        PrometheusResponse response = prometheusClient.queryRange(query, start, end, stepSeconds);
        return TimeSeries.builder()
                .name("gc_pause_count")
                .labels(Map.of(SERVICE_LABEL, serviceName))
                .dataPoints(extractFirstSeries(response))
                .build();
    }

    private InfraMetricsResponse.InstantInfraMetrics buildInstantInfraMetrics(
            String serviceName, String rateWindow) {
        // Process CPU
        String cpuQuery = PromQLBuilder.metric("process_cpu_seconds_total")
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        // System CPU
        String sysCpuInner = PromQLBuilder.metric("system_cpu_usage")
                .label(SERVICE_LABEL, serviceName)
                .build();
        String sysCpuQuery = "avg(" + sysCpuInner + ")";

        // JVM heap used
        String heapUsedInner = PromQLBuilder.metric("jvm_memory_used_bytes")
                .label(SERVICE_LABEL, serviceName)
                .label("area", "heap")
                .build();
        String heapUsedQuery = "sum(" + heapUsedInner + ")";

        // JVM heap max
        String heapMaxInner = PromQLBuilder.metric("jvm_memory_max_bytes")
                .label(SERVICE_LABEL, serviceName)
                .label("area", "heap")
                .build();
        String heapMaxQuery = "sum(" + heapMaxInner + ")";

        // JVM non-heap used
        String nonHeapInner = PromQLBuilder.metric("jvm_memory_used_bytes")
                .label(SERVICE_LABEL, serviceName)
                .label("area", "nonheap")
                .build();
        String nonHeapQuery = "sum(" + nonHeapInner + ")";

        // Process RSS
        String rssInner = PromQLBuilder.metric("process_resident_memory_bytes")
                .label(SERVICE_LABEL, serviceName)
                .build();
        String rssQuery = "sum(" + rssInner + ")";

        // Threads
        String threadsInner = PromQLBuilder.metric("jvm_threads_live_threads")
                .label(SERVICE_LABEL, serviceName)
                .build();
        String threadsQuery = "sum(" + threadsInner + ")";

        // Classes
        String classesInner = PromQLBuilder.metric("jvm_classes_loaded_classes")
                .label(SERVICE_LABEL, serviceName)
                .build();
        String classesQuery = "sum(" + classesInner + ")";

        // GC pause
        String gcQuery = PromQLBuilder.metric("jvm_gc_pause_seconds_sum")
                .label(SERVICE_LABEL, serviceName)
                .rate(rateWindow)
                .sum()
                .build();

        return InfraMetricsResponse.InstantInfraMetrics.builder()
                .cpuUsageCores(extractInstantValue(prometheusClient.query(cpuQuery)))
                .systemCpuUtilisation(extractInstantValue(prometheusClient.query(sysCpuQuery)))
                .memoryUsageBytes(extractInstantValue(prometheusClient.query(heapUsedQuery)))
                .jvmMemoryHeapMaxBytes(extractInstantValue(prometheusClient.query(heapMaxQuery)))
                .jvmMemoryNonHeapUsedBytes(extractInstantValue(prometheusClient.query(nonHeapQuery)))
                .processResidentMemoryBytes(extractInstantValue(prometheusClient.query(rssQuery)))
                .jvmThreadsLive(extractInstantValue(prometheusClient.query(threadsQuery)))
                .jvmClassesLoaded(extractInstantValue(prometheusClient.query(classesQuery)))
                .gcPauseSeconds(extractInstantValue(prometheusClient.query(gcQuery)))
                .build();
    }

    // ── Response parsing helpers ────────────────────────────────────────────────

    /** Extract data points from the first result series (for single-series range queries). */
    private List<MetricDataPoint> extractFirstSeries(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return Collections.emptyList();
        }

        PrometheusResponse.PromResult first = response.getData().getResult().getFirst();
        return parseDataPoints(first);
    }

    /** Extract multiple named time-series from a range query (one per label combination). */
    private List<TimeSeries> extractMultiSeries(PrometheusResponse response, String seriesName) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null) {
            return Collections.emptyList();
        }

        List<TimeSeries> seriesList = new ArrayList<>();
        for (PrometheusResponse.PromResult result : response.getData().getResult()) {
            List<MetricDataPoint> points = parseDataPoints(result);
            seriesList.add(TimeSeries.builder()
                    .name(seriesName)
                    .labels(result.getMetric() != null ? result.getMetric() : Map.of())
                    .dataPoints(points)
                    .build());
        }
        return seriesList;
    }

    /** Parse [timestamp, value] pairs from a range query result. */
    private List<MetricDataPoint> parseDataPoints(PrometheusResponse.PromResult result) {
        if (result.getValues() == null) {
            return Collections.emptyList();
        }

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

    /** Extract a single instant value from the first result. */
    private Double extractInstantValue(PrometheusResponse response) {
        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return null;
        }
        return parseInstantValue(response.getData().getResult().getFirst());
    }

    private Double parseInstantValue(PrometheusResponse.PromResult result) {
        if (result.getValue() != null && result.getValue().size() >= 2) {
            double val = parseDouble(result.getValue().get(1));
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
}

package com.observability.apm.service;

import com.observability.apm.dto.TraceDetailResponse;
import com.observability.apm.dto.TraceSearchResponse;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import com.observability.apm.jaeger.JaegerResponse.JaegerProcess;
import com.observability.apm.jaeger.JaegerResponse.JaegerSpan;
import com.observability.apm.jaeger.JaegerResponse.JaegerTrace;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Story 7.2 / 7.3 — Trace service layer.
 * Resolves service identity, calls Jaeger Query API, and maps
 * Jaeger response format to frontend-facing DTOs.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TraceService {

    private final ServiceRepository serviceRepository;
    private final JaegerClient jaegerClient;

    /**
     * Search traces for a registered service.
     *
     * @param serviceId   service UUID
     * @param operation   operation name / HTTP route filter — nullable (Story 7.3)
     * @param start       range start
     * @param end         range end
     * @param minDuration minimum duration filter (e.g. "100ms") — nullable
     * @param maxDuration maximum duration filter — nullable
     * @param limit       max traces to return (default 20)
     * @param tags        Jaeger tag filter JSON — nullable
     * @return trace search response with summaries
     */
    public TraceSearchResponse searchTraces(UUID serviceId, String operation,
                                             Instant start, Instant end,
                                             String minDuration, String maxDuration,
                                             int limit, String tags) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));

        JaegerResponse jaegerResponse = jaegerClient.getTraces(
                service.getName(), operation, start, end, minDuration, maxDuration, limit, tags);

        List<TraceSearchResponse.TraceSummary> summaries = new ArrayList<>();
        if (jaegerResponse.getData() != null) {
            for (JaegerTrace trace : jaegerResponse.getData()) {
                summaries.add(mapToSummary(trace));
            }
        }

        return TraceSearchResponse.builder()
                .traces(summaries)
                .total(jaegerResponse.getTotal())
                .limit(limit)
                .build();
    }

    /**
     * Story 7.3 — List available operations (endpoints) for a service.
     */
    public List<String> getOperations(UUID serviceId) {
        ServiceEntity service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));
        return jaegerClient.getOperations(service.getName());
    }

    /**
     * Get full trace detail by trace ID.
     *
     * @param traceId distributed trace ID
     * @return full trace with span details
     */
    public TraceDetailResponse getTraceDetail(String traceId) {
        JaegerResponse jaegerResponse = jaegerClient.getTrace(traceId);

        if (jaegerResponse.getData() == null || jaegerResponse.getData().isEmpty()) {
            throw new ResourceNotFoundException("Trace", traceId);
        }

        JaegerTrace trace = jaegerResponse.getData().getFirst();
        return mapToDetail(trace);
    }

    // ── Mapping: Jaeger → TraceSummary ────────────────────────────────────────

    private TraceSearchResponse.TraceSummary mapToSummary(JaegerTrace trace) {
        List<JaegerSpan> spans = trace.getSpans() != null ? trace.getSpans() : List.of();
        Map<String, JaegerProcess> processes = trace.getProcesses() != null ? trace.getProcesses() : Map.of();

        // Find root span (earliest start time, or span with no parent)
        JaegerSpan rootSpan = findRootSpan(spans);

        String rootService = "unknown";
        String rootOperation = "unknown";
        long startTime = 0;
        long traceDuration = 0;

        if (rootSpan != null) {
            rootOperation = rootSpan.getOperationName();
            startTime = rootSpan.getStartTime();
            JaegerProcess rootProcess = processes.get(rootSpan.getProcessId());
            if (rootProcess != null) {
                rootService = rootProcess.getServiceName();
            }
        }

        // Trace duration = max(span.startTime + span.duration) - min(span.startTime)
        long minStart = spans.stream().mapToLong(JaegerSpan::getStartTime).min().orElse(startTime);
        long maxEnd = spans.stream().mapToLong(s -> s.getStartTime() + s.getDuration()).max().orElse(startTime);
        traceDuration = maxEnd - minStart;

        // Count error spans
        int errorCount = (int) spans.stream()
                .filter(this::isErrorSpan)
                .count();

        // Distinct services
        List<String> services = spans.stream()
                .map(s -> {
                    JaegerProcess p = processes.get(s.getProcessId());
                    return p != null ? p.getServiceName() : "unknown";
                })
                .distinct()
                .sorted()
                .toList();

        // Extract HTTP fields from root span tags
        Integer httpStatusCode = null;
        String httpMethod = null;
        String httpUrl = null;
        String httpRoute = null;

        if (rootSpan != null && rootSpan.getTags() != null) {
            Map<String, String> rootTags = new LinkedHashMap<>();
            rootSpan.getTags().forEach(t -> rootTags.put(t.getKey(), String.valueOf(t.getValue())));

            httpMethod = rootTags.get("http.method");
            if (httpMethod == null) httpMethod = rootTags.get("http.request.method");
            httpUrl = rootTags.get("http.url");
            if (httpUrl == null) httpUrl = rootTags.get("url.full");
            httpRoute = rootTags.get("http.route");
            if (httpRoute == null) httpRoute = rootTags.get("url.path");

            httpStatusCode = parseStatusCode(rootTags);
        }

        return TraceSearchResponse.TraceSummary.builder()
                .traceId(trace.getTraceId())
                .rootService(rootService)
                .rootOperation(rootOperation)
                .startTime(Instant.ofEpochSecond(startTime / 1_000_000L,
                        (startTime % 1_000_000L) * 1_000L).toString())
                .durationMicros(traceDuration)
                .spanCount(spans.size())
                .errorCount(errorCount)
                .services(services)
                .httpStatusCode(httpStatusCode)
                .httpMethod(httpMethod)
                .httpUrl(httpUrl)
                .httpRoute(httpRoute)
                .build();
    }

    // ── Mapping: Jaeger → TraceDetailResponse ─────────────────────────────────

    private TraceDetailResponse mapToDetail(JaegerTrace trace) {
        List<JaegerSpan> spans = trace.getSpans() != null ? trace.getSpans() : List.of();
        Map<String, JaegerProcess> processes = trace.getProcesses() != null ? trace.getProcesses() : Map.of();

        // Build a set of all span IDs to resolve parent references
        Set<String> spanIds = spans.stream()
                .map(JaegerSpan::getSpanId)
                .collect(Collectors.toSet());

        long minStart = spans.stream().mapToLong(JaegerSpan::getStartTime).min().orElse(0);
        long maxEnd = spans.stream().mapToLong(s -> s.getStartTime() + s.getDuration()).max().orElse(0);

        int errorCount = (int) spans.stream().filter(this::isErrorSpan).count();

        List<String> services = spans.stream()
                .map(s -> {
                    JaegerProcess p = processes.get(s.getProcessId());
                    return p != null ? p.getServiceName() : "unknown";
                })
                .distinct()
                .sorted()
                .toList();

        List<TraceDetailResponse.SpanDetail> spanDetails = spans.stream()
                .map(s -> mapSpanDetail(s, processes))
                .sorted(Comparator.comparingLong(TraceDetailResponse.SpanDetail::getStartTime))
                .toList();

        return TraceDetailResponse.builder()
                .traceId(trace.getTraceId())
                .durationMicros(maxEnd - minStart)
                .startTime(Instant.ofEpochSecond(minStart / 1_000_000L,
                        (minStart % 1_000_000L) * 1_000L).toString())
                .spanCount(spans.size())
                .errorCount(errorCount)
                .services(services)
                .spans(spanDetails)
                .build();
    }

    private TraceDetailResponse.SpanDetail mapSpanDetail(JaegerSpan span,
                                                          Map<String, JaegerProcess> processes) {
        JaegerProcess process = processes.get(span.getProcessId());
        String serviceName = process != null ? process.getServiceName() : "unknown";

        // Resolve parent span ID from references
        String parentSpanId = null;
        if (span.getReferences() != null) {
            parentSpanId = span.getReferences().stream()
                    .filter(ref -> "CHILD_OF".equals(ref.getRefType()))
                    .map(JaegerResponse.JaegerReference::getSpanId)
                    .findFirst()
                    .orElse(null);
        }

        // Extract tags to a flat map
        Map<String, String> tags = new LinkedHashMap<>();
        if (span.getTags() != null) {
            span.getTags().forEach(t -> tags.put(t.getKey(), String.valueOf(t.getValue())));
        }

        // Extract common HTTP tags (OTel + legacy conventions)
        String httpMethod = tags.get("http.method");
        if (httpMethod == null) httpMethod = tags.get("http.request.method");
        String httpUrl = tags.get("http.url");
        if (httpUrl == null) httpUrl = tags.get("url.full");
        String httpRoute = tags.get("http.route");
        if (httpRoute == null) httpRoute = tags.get("url.path");
        Integer httpStatusCode = parseStatusCode(tags);

        // When http.route is absent, enrich the operation name with http.method + http.url
        String operationName = span.getOperationName();
        if (httpRoute == null && httpUrl != null) {
            operationName = httpMethod != null
                    ? httpMethod + " " + httpUrl
                    : httpUrl;
        }

        boolean hasError = isErrorSpan(span);

        // Map span logs
        List<TraceDetailResponse.SpanLog> logs = List.of();
        if (span.getLogs() != null) {
            logs = span.getLogs().stream().map(l -> {
                Map<String, String> fields = new LinkedHashMap<>();
                if (l.getFields() != null) {
                    l.getFields().forEach(f -> fields.put(f.getKey(), String.valueOf(f.getValue())));
                }
                return TraceDetailResponse.SpanLog.builder()
                        .timestamp(l.getTimestamp())
                        .fields(fields)
                        .build();
            }).toList();
        }

        return TraceDetailResponse.SpanDetail.builder()
                .spanId(span.getSpanId())
                .parentSpanId(parentSpanId)
                .operationName(operationName)
                .serviceName(serviceName)
                .startTime(span.getStartTime())
                .durationMicros(span.getDuration())
                .hasError(hasError)
                .httpStatusCode(httpStatusCode)
                .httpMethod(httpMethod)
                .httpUrl(httpUrl)
                .tags(tags)
                .logs(logs)
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private JaegerSpan findRootSpan(List<JaegerSpan> spans) {
        // Root = span with no CHILD_OF parent reference, or earliest span
        return spans.stream()
                .filter(s -> s.getReferences() == null || s.getReferences().isEmpty()
                        || s.getReferences().stream().noneMatch(r -> "CHILD_OF".equals(r.getRefType())))
                .min(Comparator.comparingLong(JaegerSpan::getStartTime))
                .orElseGet(() -> spans.stream()
                        .min(Comparator.comparingLong(JaegerSpan::getStartTime))
                        .orElse(null));
    }

    /**
     * Parse HTTP status code from tags — checks OTel and legacy tag names.
     */
    private Integer parseStatusCode(Map<String, String> tags) {
        String raw = tags.get("http.response.status_code");
        if (raw == null) raw = tags.get("http.status_code");
        if (raw == null) return null;
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isErrorSpan(JaegerSpan span) {
        if (span.getTags() == null) return false;
        return span.getTags().stream()
                .anyMatch(t -> "error".equals(t.getKey()) && "true".equals(String.valueOf(t.getValue())));
    }
}

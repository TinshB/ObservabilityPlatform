package com.observability.apm.service;

import com.observability.apm.dto.JaegerServiceInfo;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
import com.observability.apm.jaeger.JaegerResponse.JaegerProcess;
import com.observability.apm.jaeger.JaegerResponse.JaegerSpan;
import com.observability.apm.jaeger.JaegerResponse.JaegerTag;
import com.observability.apm.jaeger.JaegerResponse.JaegerTrace;
import com.observability.apm.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Discovers services from Jaeger traces with metadata extracted from
 * OTel process/resource tags (telemetry.sdk.language, etc.) and
 * computes per-service error rate and throughput.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class JaegerServiceDiscoveryService {

    private static final int TRACES_PER_SERVICE = 200;

    private final JaegerClient jaegerClient;
    private final ServiceRepository serviceRepository;

    /**
     * Discover all services from Jaeger with their type, error rate, and throughput.
     *
     * @param lookbackSeconds how far back to look for traces (default 15 minutes)
     */
    public List<JaegerServiceInfo> discoverServices(long lookbackSeconds) {
        // 1. Get all service names from Jaeger
        List<String> serviceNames = jaegerClient.getServices();
        if (serviceNames == null || serviceNames.isEmpty()) {
            return List.of();
        }

        // 2. Get registered service names from DB for the "registered" flag
        Set<String> registeredNames = new HashSet<>();
        serviceRepository.findAll().forEach(e -> registeredNames.add(e.getName()));

        Instant end = Instant.now();
        Instant start = end.minusSeconds(lookbackSeconds);

        // 3. For each service, fetch traces and extract metadata
        List<JaegerServiceInfo> result = new ArrayList<>();
        for (String serviceName : serviceNames) {
            try {
                JaegerServiceInfo info = buildServiceInfo(serviceName, start, end, registeredNames);
                if (info != null) {
                    result.add(info);
                }
            } catch (Exception ex) {
                log.warn("Failed to fetch info for service {}: {}", serviceName, ex.getMessage());
                // Still include with minimal info
                result.add(JaegerServiceInfo.builder()
                        .name(serviceName)
                        .serviceType("unknown")
                        .registered(registeredNames.contains(serviceName))
                        .build());
            }
        }

        // Sort: registered first, then by trace count descending
        result.sort((a, b) -> {
            if (a.isRegistered() != b.isRegistered()) return a.isRegistered() ? -1 : 1;
            return Integer.compare(b.getTraceCount(), a.getTraceCount());
        });

        return result;
    }

    private JaegerServiceInfo buildServiceInfo(String serviceName, Instant start, Instant end,
                                                 Set<String> registeredNames) {
        JaegerResponse response = jaegerClient.getTraces(
                serviceName, null, start, end, null, null, TRACES_PER_SERVICE, null);

        List<JaegerTrace> traces = response.getData() != null ? response.getData() : List.of();

        if (traces.isEmpty()) {
            return JaegerServiceInfo.builder()
                    .name(serviceName)
                    .serviceType(detectServiceType(serviceName, List.of()))
                    .registered(registeredNames.contains(serviceName))
                    .build();
        }

        // Extract service type from process tags
        String serviceType = "unknown";
        int totalSpans = 0;
        int errorTraces = 0;

        for (JaegerTrace trace : traces) {
            Map<String, JaegerProcess> processes = trace.getProcesses();
            List<JaegerSpan> spans = trace.getSpans();
            if (spans == null) continue;

            // Find the process for this service and extract SDK language
            if ("unknown".equals(serviceType) && processes != null) {
                for (JaegerProcess proc : processes.values()) {
                    if (serviceName.equals(proc.getServiceName()) && proc.getTags() != null) {
                        serviceType = extractSdkLanguage(proc.getTags());
                        if (!"unknown".equals(serviceType)) break;
                    }
                }
            }

            // Count spans belonging to this service
            int serviceSpans = 0;
            boolean hasError = false;
            for (JaegerSpan span : spans) {
                if (processes != null) {
                    JaegerProcess proc = processes.get(span.getProcessId());
                    if (proc != null && serviceName.equals(proc.getServiceName())) {
                        serviceSpans++;
                        if (isErrorSpan(span)) hasError = true;
                    }
                }
            }
            totalSpans += serviceSpans;
            if (hasError) errorTraces++;
        }

        long rangeSecs = Math.max(1, end.getEpochSecond() - start.getEpochSecond());
        double errorRate = traces.size() > 0 ? (errorTraces * 100.0) / traces.size() : 0;
        double throughput = (double) traces.size() / rangeSecs;

        return JaegerServiceInfo.builder()
                .name(serviceName)
                .serviceType(mapServiceType(serviceType))
                .errorRate(Math.round(errorRate * 100.0) / 100.0)
                .throughput(Math.round(throughput * 1000.0) / 1000.0)
                .traceCount(traces.size())
                .spanCount(totalSpans)
                .registered(registeredNames.contains(serviceName))
                .build();
    }

    /**
     * Extract SDK language from process-level tags.
     */
    private String extractSdkLanguage(List<JaegerTag> tags) {
        for (JaegerTag tag : tags) {
            if ("telemetry.sdk.language".equals(tag.getKey())) {
                return String.valueOf(tag.getValue());
            }
        }
        // Fallback: check otel scope names from any span
        for (JaegerTag tag : tags) {
            if ("process.runtime.name".equals(tag.getKey())) {
                String runtime = String.valueOf(tag.getValue()).toLowerCase();
                if (runtime.contains("java") || runtime.contains("jdk") || runtime.contains("hotspot")) return "java";
                if (runtime.contains("node") || runtime.contains("v8")) return "nodejs";
                if (runtime.contains("python") || runtime.contains("cpython")) return "python";
                if (runtime.contains("go")) return "go";
            }
        }
        return "unknown";
    }

    /**
     * Map raw SDK language to a user-friendly service type label.
     */
    private String mapServiceType(String sdkLanguage) {
        if (sdkLanguage == null) return "Unknown";
        return switch (sdkLanguage.toLowerCase()) {
            case "java" -> "Java";
            case "webjs", "javascript" -> "React / JS";
            case "nodejs" -> "Node.js";
            case "python" -> "Python";
            case "go" -> "Go";
            case "dotnet", "csharp" -> ".NET";
            case "ruby" -> "Ruby";
            case "php" -> "PHP";
            case "rust" -> "Rust";
            default -> sdkLanguage;
        };
    }

    /**
     * Fallback service type detection from service name patterns.
     */
    private String detectServiceType(String serviceName, List<JaegerTrace> traces) {
        String lower = serviceName.toLowerCase();
        if (lower.contains("frontend") || lower.contains("ui") || lower.contains("web")) return "React / JS";
        if (lower.contains("gateway") || lower.contains("proxy")) return "Gateway";
        return "unknown";
    }

    private boolean isErrorSpan(JaegerSpan span) {
        if (span.getTags() == null) return false;
        for (JaegerTag tag : span.getTags()) {
            if ("error".equals(tag.getKey()) && "true".equals(String.valueOf(tag.getValue()))) return true;
            if ("otel.status_code".equals(tag.getKey()) && "ERROR".equals(String.valueOf(tag.getValue()))) return true;
        }
        return false;
    }
}

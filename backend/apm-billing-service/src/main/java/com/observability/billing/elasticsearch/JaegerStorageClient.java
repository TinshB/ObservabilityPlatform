package com.observability.billing.elasticsearch;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.observability.billing.config.JaegerProperties;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * US-BILL-003 — Client for querying Jaeger trace statistics via the Jaeger Query API.
 * <p>
 * Uses the same API the trace explorer uses:
 * <ul>
 *   <li>{@code GET /api/services} — list known services</li>
 *   <li>{@code GET /api/traces?service=...&limit=...} — fetch traces per service</li>
 * </ul>
 * Storage is estimated from span counts using a configurable average span size.
 */
@Slf4j
@Component
public class JaegerStorageClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;
    private final int avgSpanSizeBytes;

    public JaegerStorageClient(JaegerProperties props) {
        this.baseUrl = props.getQueryUrl();
        this.avgSpanSizeBytes = props.getAvgSpanSizeBytes();

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(props.getConnectTimeout()));
        factory.setReadTimeout(Duration.ofMillis(props.getReadTimeout()));
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * List all service names known to Jaeger.
     */
    public List<String> getServices() {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/services")
                .build().encode().toUri();

        try {
            ResponseEntity<JaegerServicesResponse> response = restTemplate.exchange(
                    uri, HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {});
            JaegerServicesResponse body = response.getBody();
            if (body != null && body.getData() != null) {
                // Filter out the internal "jaeger-query" service
                return body.getData().stream()
                        .filter(s -> !"jaeger-query".equalsIgnoreCase(s)
                                  && !"jaeger-all-in-one".equalsIgnoreCase(s))
                        .toList();
            }
            return List.of();
        } catch (RestClientException ex) {
            log.error("Jaeger services query failed: {}", ex.getMessage());
            return List.of();
        }
    }

    /**
     * Get per-service span counts by fetching recent traces for each service.
     * <p>
     * Queries the last 24 hours of traces with a high limit to get representative counts.
     *
     * @return map of service name → total span count, ordered by count descending
     */
    public Map<String, Long> getSpanCountByService() {
        List<String> services = getServices();
        if (services.isEmpty()) {
            return Map.of();
        }

        Instant end = Instant.now();
        Instant start = end.minus(Duration.ofDays(1));

        Map<String, Long> counts = new LinkedHashMap<>();
        for (String service : services) {
            long spanCount = countSpansForService(service, start, end);
            if (spanCount > 0) {
                counts.put(service, spanCount);
            }
        }

        // Sort descending by count
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey, Map.Entry::getValue,
                        (a, b) -> a, LinkedHashMap::new));
    }

    /**
     * Get total span count across all services.
     */
    public long getTotalSpanCount() {
        Map<String, Long> byService = getSpanCountByService();
        return byService.values().stream().mapToLong(Long::longValue).sum();
    }

    /**
     * Get distinct trace count across all services.
     */
    public long getDistinctTraceCount() {
        List<String> services = getServices();
        if (services.isEmpty()) return 0;

        Instant end = Instant.now();
        Instant start = end.minus(Duration.ofDays(1));

        long totalTraces = 0;
        for (String service : services) {
            totalTraces += countTracesForService(service, start, end);
        }
        return totalTraces;
    }

    /**
     * Estimate total storage size based on total span count and average span size.
     */
    public long estimateStorageBytes(long totalSpanCount) {
        return totalSpanCount * avgSpanSizeBytes;
    }

    /**
     * Get the configured average span size in bytes.
     */
    public int getAvgSpanSizeBytes() {
        return avgSpanSizeBytes;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private long countSpansForService(String service, Instant start, Instant end) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/traces")
                .queryParam("service", service)
                .queryParam("start", toMicros(start))
                .queryParam("end", toMicros(end))
                .queryParam("limit", 1000)
                .queryParam("lookback", "custom")
                .build().encode().toUri();

        try {
            JsonNode response = restTemplate.getForObject(uri, JsonNode.class);
            if (response == null) return 0;

            JsonNode data = response.path("data");
            if (!data.isArray()) return 0;

            long totalSpans = 0;
            for (JsonNode trace : data) {
                JsonNode spans = trace.path("spans");
                if (spans.isArray()) {
                    totalSpans += spans.size();
                }
            }
            return totalSpans;

        } catch (RestClientException ex) {
            log.error("Jaeger span count query failed for service [{}]: {}", service, ex.getMessage());
            return 0;
        }
    }

    private long countTracesForService(String service, Instant start, Instant end) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/traces")
                .queryParam("service", service)
                .queryParam("start", toMicros(start))
                .queryParam("end", toMicros(end))
                .queryParam("limit", 1000)
                .queryParam("lookback", "custom")
                .build().encode().toUri();

        try {
            JsonNode response = restTemplate.getForObject(uri, JsonNode.class);
            if (response == null) return 0;

            JsonNode data = response.path("data");
            return data.isArray() ? data.size() : 0;

        } catch (RestClientException ex) {
            log.error("Jaeger trace count query failed for service [{}]: {}", service, ex.getMessage());
            return 0;
        }
    }

    /** Convert Instant to microseconds since epoch (Jaeger's time format). */
    private static long toMicros(Instant instant) {
        return instant.getEpochSecond() * 1_000_000L + instant.getNano() / 1_000L;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerServicesResponse {
        private List<String> data;
    }
}

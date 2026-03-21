package com.observability.apm.jaeger;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.observability.apm.config.JaegerProperties;
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
import java.util.List;

/**
 * Story 7.2 — HTTP client for the Jaeger Query API.
 * Follows the same pattern as {@link com.observability.apm.prometheus.PrometheusClient}.
 *
 * <p>Jaeger Query API reference:
 * <ul>
 *   <li>{@code GET /api/traces?service=...&start=...&end=...&limit=...}</li>
 *   <li>{@code GET /api/traces/{traceId}}</li>
 *   <li>{@code GET /api/services}</li>
 * </ul>
 */
@Slf4j
@Component
public class JaegerClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public JaegerClient(JaegerProperties props) {
        this.baseUrl = props.getQueryUrl();

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(props.getConnectTimeout()));
        factory.setReadTimeout(Duration.ofMillis(props.getReadTimeout()));
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Search traces for a service with filters.
     *
     * @param service     service name (required by Jaeger)
     * @param operation   operation name / HTTP route filter — nullable
     * @param start       range start
     * @param end         range end
     * @param minDuration minimum trace duration (e.g. "100ms", "1s") — nullable
     * @param maxDuration maximum trace duration — nullable
     * @param limit       max number of traces to return
     * @param tags        Jaeger tag filter in JSON format (e.g. {"error":"true"}) — nullable
     * @return Jaeger response containing matching traces
     */
    public JaegerResponse getTraces(String service, String operation, Instant start, Instant end,
                                     String minDuration, String maxDuration,
                                     int limit, String tags) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/traces")
                .queryParam("service", service)
                .queryParam("start", toMicros(start))
                .queryParam("end", toMicros(end))
                .queryParam("limit", limit);

        if (operation != null && !operation.isBlank()) {
            builder.queryParam("operation", operation);
        }
        if (minDuration != null && !minDuration.isBlank()) {
            builder.queryParam("minDuration", minDuration);
        }
        if (maxDuration != null && !maxDuration.isBlank()) {
            builder.queryParam("maxDuration", maxDuration);
        }
        if (tags != null && !tags.isBlank()) {
            builder.queryParam("tags", tags);
        }

        URI uri = builder.build().encode().toUri();

        log.debug("Jaeger trace search: service={}, operation={}, start={}, end={}, limit={}",
                service, operation, start, end, limit);
        return executeTraceQuery(uri);
    }

    /**
     * Story 7.3 — List available operations (endpoints) for a service in Jaeger.
     *
     * @param service service name
     * @return list of operation names
     */
    public List<String> getOperations(String service) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/services/{service}/operations")
                .buildAndExpand(service)
                .encode()
                .toUri();

        try {
            ResponseEntity<JaegerServicesResponse> response = restTemplate.exchange(
                    uri, HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {});
            JaegerServicesResponse body = response.getBody();
            return (body != null && body.getData() != null) ? body.getData() : List.of();
        } catch (RestClientException ex) {
            log.error("Jaeger operations query failed for service [{}]: {}", service, ex.getMessage());
            return List.of();
        }
    }

    /**
     * Retrieve a single trace by its trace ID.
     *
     * @param traceId the distributed trace ID
     * @return Jaeger response containing the trace (data list will have 0 or 1 element)
     */
    public JaegerResponse getTrace(String traceId) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/traces/{traceId}")
                .buildAndExpand(traceId)
                .encode()
                .toUri();

        log.debug("Jaeger trace detail: traceId={}", traceId);
        return executeTraceQuery(uri);
    }

    /**
     * List all service names known to Jaeger.
     *
     * @return list of service names
     */
    public List<String> getServices() {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/services")
                .build()
                .encode()
                .toUri();

        try {
            ResponseEntity<JaegerServicesResponse> response = restTemplate.exchange(
                    uri, HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {});
            JaegerServicesResponse body = response.getBody();
            return (body != null && body.getData() != null) ? body.getData() : List.of();
        } catch (RestClientException ex) {
            log.error("Jaeger services query failed [{}]: {}", uri, ex.getMessage());
            return List.of();
        }
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private JaegerResponse executeTraceQuery(URI uri) {
        try {
            JaegerResponse response = restTemplate.getForObject(uri, JaegerResponse.class);
            if (response != null && response.getErrors() != null && !response.getErrors().isEmpty()) {
                log.warn("Jaeger query returned errors: {}", response.getErrors());
            }
            return response != null ? response : emptyResponse();
        } catch (RestClientException ex) {
            log.error("Jaeger query failed [{}]: {}", uri, ex.getMessage());
            return emptyResponse();
        }
    }

    private static JaegerResponse emptyResponse() {
        JaegerResponse empty = new JaegerResponse();
        empty.setData(List.of());
        return empty;
    }

    /** Convert Instant to microseconds since epoch (Jaeger's time format). */
    private static long toMicros(Instant instant) {
        return instant.getEpochSecond() * 1_000_000L + instant.getNano() / 1_000L;
    }

    /** Response wrapper for /api/services. */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class JaegerServicesResponse {
        private List<String> data;
    }
}

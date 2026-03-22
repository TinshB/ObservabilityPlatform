package com.observability.billing.prometheus;

import com.fasterxml.jackson.databind.JsonNode;
import com.observability.billing.config.PrometheusProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * US-BILL-002 — Client for querying Prometheus TSDB storage statistics.
 * Uses the Prometheus HTTP API to retrieve TSDB status and per-service series counts.
 */
@Slf4j
@Component
public class PrometheusStorageClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public PrometheusStorageClient(PrometheusProperties config) {
        this.baseUrl = config.getUrl();

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(config.getConnectTimeout()));
        factory.setReadTimeout(Duration.ofMillis(config.getReadTimeout()));
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Fetch TSDB status from Prometheus.
     *
     * @return TsdbStatus containing headStats (numSeries, numLabelValuePairs, etc.)
     */
    public TsdbStatus getTsdbStatus() {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/v1/status/tsdb")
                .build().toUri();

        try {
            JsonNode response = restTemplate.getForObject(uri, JsonNode.class);
            if (response == null || !"success".equals(response.path("status").asText())) {
                log.warn("Prometheus TSDB status returned non-success: {}", response);
                return TsdbStatus.empty();
            }

            JsonNode data = response.path("data");
            JsonNode headStats = data.path("headStats");

            long numSeries = headStats.path("numSeries").asLong(0);
            long numLabelPairs = headStats.path("numLabelPairs").asLong(0);
            long numChunks = headStats.path("numChunks").asLong(0);
            long minTime = headStats.path("minTime").asLong(0);
            long maxTime = headStats.path("maxTime").asLong(0);

            return new TsdbStatus(numSeries, numLabelPairs, numChunks, minTime, maxTime);

        } catch (RestClientException ex) {
            log.error("Failed to fetch Prometheus TSDB status [{}]: {}", uri, ex.getMessage());
            return TsdbStatus.empty();
        }
    }

    /**
     * Fetch the total TSDB storage size on disk using the runtime info endpoint.
     *
     * @return storage size in bytes, or 0 if unavailable
     */
    public long getTsdbStorageSizeBytes() {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/v1/status/runtimeinfo")
                .build().toUri();

        try {
            JsonNode response = restTemplate.getForObject(uri, JsonNode.class);
            if (response == null || !"success".equals(response.path("status").asText())) {
                // Fallback: estimate from series count
                return 0;
            }

            JsonNode data = response.path("data");
            String storageRetention = data.path("storageRetention").asText("15d");
            log.debug("Prometheus storage retention: {}", storageRetention);

            // storageRetention is the configured retention period
            // The actual disk usage is not directly in runtimeinfo,
            // so we'll query it via a PromQL query on prometheus_tsdb_storage_size_bytes
            return queryStorageSizeMetric();

        } catch (RestClientException ex) {
            log.error("Failed to fetch Prometheus runtime info: {}", ex.getMessage());
            return queryStorageSizeMetric();
        }
    }

    /**
     * Get the configured retention period from Prometheus runtime info.
     *
     * @return retention string (e.g., "15d") or "15d" as default
     */
    public String getRetentionPeriod() {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/v1/status/runtimeinfo")
                .build().toUri();

        try {
            JsonNode response = restTemplate.getForObject(uri, JsonNode.class);
            if (response != null && "success".equals(response.path("status").asText())) {
                return response.path("data").path("storageRetention").asText("15d");
            }
        } catch (RestClientException ex) {
            log.error("Failed to fetch Prometheus retention info: {}", ex.getMessage());
        }
        return "15d";
    }

    /**
     * Get per-service (job) active series counts using PromQL.
     *
     * @return map of job name → series count, ordered by count descending
     */
    public Map<String, Long> getSeriesCountByJob() {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/v1/query")
                .queryParam("query", "count by (job) ({__name__!=\"\"})")
                .build().encode().toUri();

        try {
            JsonNode response = restTemplate.getForObject(uri, JsonNode.class);
            if (response == null || !"success".equals(response.path("status").asText())) {
                log.warn("Prometheus series-by-job query returned non-success");
                return Map.of();
            }

            JsonNode results = response.path("data").path("result");
            Map<String, Long> jobCounts = new LinkedHashMap<>();

            for (JsonNode result : results) {
                String jobName = result.path("metric").path("job").asText("unknown");
                long count = 0;
                JsonNode value = result.path("value");
                if (value.isArray() && value.size() > 1) {
                    count = Long.parseLong(value.get(1).asText("0"));
                }
                jobCounts.put(jobName, count);
            }

            // Sort by count descending
            return jobCounts.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .collect(java.util.stream.Collectors.toMap(
                            Map.Entry::getKey, Map.Entry::getValue,
                            (a, b) -> a, LinkedHashMap::new));

        } catch (RestClientException ex) {
            log.error("Failed to fetch Prometheus series-by-job: {}", ex.getMessage());
            return Map.of();
        }
    }

    /**
     * Query Prometheus for its own TSDB storage size metric.
     */
    private long queryStorageSizeMetric() {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/v1/query")
                .queryParam("query", "prometheus_tsdb_storage_size_bytes")
                .build().encode().toUri();

        try {
            JsonNode response = restTemplate.getForObject(uri, JsonNode.class);
            if (response != null && "success".equals(response.path("status").asText())) {
                JsonNode results = response.path("data").path("result");
                if (results.isArray() && !results.isEmpty()) {
                    JsonNode value = results.get(0).path("value");
                    if (value.isArray() && value.size() > 1) {
                        return Long.parseLong(value.get(1).asText("0"));
                    }
                }
            }
        } catch (Exception ex) {
            log.error("Failed to query prometheus_tsdb_storage_size_bytes: {}", ex.getMessage());
        }
        return 0;
    }

    /**
     * TSDB head stats from Prometheus /api/v1/status/tsdb endpoint.
     */
    public record TsdbStatus(
            long numSeries,
            long numLabelPairs,
            long numChunks,
            long minTime,
            long maxTime
    ) {
        public static TsdbStatus empty() {
            return new TsdbStatus(0, 0, 0, 0, 0);
        }
    }
}

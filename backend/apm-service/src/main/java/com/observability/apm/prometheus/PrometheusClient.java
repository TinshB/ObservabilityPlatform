package com.observability.apm.prometheus;

import com.observability.apm.config.PrometheusClientConfig;
import lombok.extern.slf4j.Slf4j;
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
 * HTTP client for the Prometheus Query API.
 * Supports both instant queries ({@code /api/v1/query}) and
 * range queries ({@code /api/v1/query_range}).
 */
@Slf4j
@Component
public class PrometheusClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public PrometheusClient(PrometheusClientConfig config) {
        this.baseUrl = config.getUrl();

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(config.getConnectTimeout()));
        factory.setReadTimeout(Duration.ofMillis(config.getReadTimeout()));
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Execute an instant query against Prometheus.
     *
     * @param promql the PromQL expression
     * @return parsed Prometheus response
     */
    public PrometheusResponse query(String promql) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/v1/query")
                .queryParam("query", promql)
                .build()
                .encode()
                .toUri();

        log.debug("Prometheus instant query: {}", promql);
        return execute(uri);
    }

    /**
     * Execute an instant query at a specific time.
     */
    public PrometheusResponse query(String promql, Instant time) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/v1/query")
                .queryParam("query", promql)
                .queryParam("time", time.getEpochSecond())
                .build()
                .encode()
                .toUri();

        log.debug("Prometheus instant query at {}: {}", time, promql);
        return execute(uri);
    }

    /**
     * Execute a range query against Prometheus.
     *
     * @param promql the PromQL expression
     * @param start  range start time
     * @param end    range end time
     * @param stepSeconds resolution in seconds (e.g. 60 for 1-minute intervals)
     * @return parsed Prometheus response with time-series data
     */
    public PrometheusResponse queryRange(String promql, Instant start, Instant end, long stepSeconds) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                .path("/api/v1/query_range")
                .queryParam("query", promql)
                .queryParam("start", start.getEpochSecond())
                .queryParam("end", end.getEpochSecond())
                .queryParam("step", stepSeconds + "s")
                .build()
                .encode()
                .toUri();

        log.debug("Prometheus range query [{} -> {}, step={}s]: {}", start, end, stepSeconds, promql);
        return execute(uri);
    }

    private PrometheusResponse execute(URI uri) {
        try {
            PrometheusResponse response = restTemplate.getForObject(uri, PrometheusResponse.class);
            if (response != null && !response.isSuccess()) {
                log.warn("Prometheus query returned error: {} - {}", response.getErrorType(), response.getError());
            }
            return response;
        } catch (RestClientException ex) {
            log.error("Prometheus query failed [{}]: {}", uri, ex.getMessage());
            PrometheusResponse empty = new PrometheusResponse();
            empty.setStatus("success");
            PrometheusResponse.PromData emptyData = new PrometheusResponse.PromData();
            emptyData.setResultType("matrix");
            emptyData.setResult(List.of());
            empty.setData(emptyData);
            return empty;
        }
    }
}

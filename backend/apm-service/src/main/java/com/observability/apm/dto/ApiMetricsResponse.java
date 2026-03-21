package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 5.2 — API-level metrics response.
 * Contains per-route latency histograms and status code distribution.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiMetricsResponse {

    private String serviceName;

    /** Per-endpoint latency time-series (one TimeSeries per route, labelled with http_route). */
    private List<TimeSeries> latencyP50ByRoute;
    private List<TimeSeries> latencyP95ByRoute;
    private List<TimeSeries> latencyP99ByRoute;

    /** Per-endpoint throughput (RPS). */
    private List<TimeSeries> throughputByRoute;

    /** Status code distribution per route. */
    private List<StatusCodeGroup> statusCodeDistribution;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusCodeGroup {
        private String httpRoute;
        private String statusCode;
        private double requestCount;
    }
}

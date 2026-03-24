package com.observability.apm.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration for query-level metrics source and thresholds.
 */
@Data
@Component
@ConfigurationProperties(prefix = "metrics")
public class QueryMetricsProperties {

    /** Slow-query threshold in seconds. Operations with P95 above this are flagged. */
    private double slowQueryThresholdSeconds = 0.5;

    /** Data source for query metrics: "jaeger" (default) or "prometheus". */
    private String queryMetricsSource = "jaeger";

    /** Max traces to fetch from Jaeger when building query metrics. */
    private int jaegerTraceLimit = 5000;
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * A named time-series with labels and data points.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeSeries {

    /** Descriptive label for this series (e.g. "latency_p95", "error_rate"). */
    private String name;

    /** Prometheus metric labels (e.g. {http_route="/api/v1/users", http_method="GET"}). */
    private Map<String, String> labels;

    /** Ordered data points. */
    private List<MetricDataPoint> dataPoints;
}

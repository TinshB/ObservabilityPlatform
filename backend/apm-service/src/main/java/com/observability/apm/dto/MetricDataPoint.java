package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A single data point in a time-series.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricDataPoint {

    /** Unix epoch timestamp in seconds. */
    private long timestamp;

    /** Metric value at the given timestamp. */
    private double value;
}

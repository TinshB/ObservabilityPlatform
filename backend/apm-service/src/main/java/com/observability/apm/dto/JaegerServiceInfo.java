package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Service information discovered from Jaeger traces.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JaegerServiceInfo {

    /** Service name as known to Jaeger. */
    private String name;

    /** Service type / SDK language (e.g. java, webjs, python, go). */
    private String serviceType;

    /** Error rate as a percentage (0-100). */
    private double errorRate;

    /** Throughput in requests/traces per second. */
    private double throughput;

    /** Total trace count in the sampled window. */
    private int traceCount;

    /** Total span count across sampled traces. */
    private int spanCount;

    /** Whether this service is registered in the DB. */
    private boolean registered;
}

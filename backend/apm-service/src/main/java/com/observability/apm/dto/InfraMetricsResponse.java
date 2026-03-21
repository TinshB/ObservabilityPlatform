package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 5.3 — Infrastructure-level metrics response.
 * Contains service-level CPU, JVM memory, threads, classes, and GC metrics
 * sourced from OTel/Micrometer instrumentation, filtered by job label.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InfraMetricsResponse {

    private String serviceName;

    // ── CPU ──────────────────────────────────────────────────────────────────────

    /** Process CPU usage rate (cores) over time — from process_cpu_seconds_total. */
    private TimeSeries processCpuUsage;

    /** System CPU utilisation (0.0–1.0) — from system_cpu_usage (Micrometer gauge). */
    private TimeSeries systemCpuUsage;

    /** Process CPU usage per instance — from process_cpu_seconds_total grouped by instance. */
    private List<TimeSeries> processCpuByInstance;

    // ── Memory ──────────────────────────────────────────────────────────────────

    /** JVM heap used bytes — from jvm_memory_used_bytes{area="heap"}. */
    private TimeSeries jvmMemoryHeapUsed;

    /** JVM heap committed bytes — from jvm_memory_committed_bytes{area="heap"}. */
    private TimeSeries jvmMemoryHeapCommitted;

    /** JVM heap max bytes — from jvm_memory_max_bytes{area="heap"}. */
    private TimeSeries jvmMemoryHeapMax;

    /** JVM non-heap used bytes — from jvm_memory_used_bytes{area="nonheap"}. */
    private TimeSeries jvmMemoryNonHeapUsed;

    /** JVM non-heap committed bytes — from jvm_memory_committed_bytes{area="nonheap"}. */
    private TimeSeries jvmMemoryNonHeapCommitted;

    /** Process resident memory bytes — from process_resident_memory_bytes. */
    private TimeSeries processResidentMemory;

    /** JVM heap used per instance — from jvm_memory_used_bytes{area="heap"} grouped by instance. */
    private List<TimeSeries> jvmMemoryHeapByInstance;

    // ── Threads ─────────────────────────────────────────────────────────────────

    /** JVM live thread count — from jvm_threads_live_threads. */
    private TimeSeries jvmThreadsLive;

    /** JVM daemon thread count — from jvm_threads_daemon_threads. */
    private TimeSeries jvmThreadsDaemon;

    // ── Classes ─────────────────────────────────────────────────────────────────

    /** JVM loaded class count — from jvm_classes_loaded_classes. */
    private TimeSeries jvmClassesLoaded;

    // ── JVM GC ──────────────────────────────────────────────────────────────────

    /** JVM GC pause time (seconds) over time — from OTel/Micrometer. */
    private TimeSeries gcPauseTime;

    /** JVM GC pause count rate — from OTel/Micrometer. */
    private TimeSeries gcPauseCount;

    // ── Current instant values ──────────────────────────────────────────────────

    private InstantInfraMetrics current;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class InstantInfraMetrics {
        private Double cpuUsageCores;
        private Double systemCpuUtilisation;
        private Double memoryUsageBytes;
        private Double jvmMemoryHeapMaxBytes;
        private Double jvmMemoryNonHeapUsedBytes;
        private Double processResidentMemoryBytes;
        private Double jvmThreadsLive;
        private Double jvmClassesLoaded;
        private Double gcPauseSeconds;
    }
}

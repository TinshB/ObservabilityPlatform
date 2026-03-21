package com.observability.apm.dto;

import lombok.Getter;

import java.time.Duration;

/**
 * Named time-range presets with pre-calculated optimal step and rate window.
 * The step is chosen to return ~120 data points for the given range.
 * The rate window is set to 4× the step (Prometheus best practice).
 */
@Getter
public enum TimeRangePreset {

    LAST_15M("Last 15 minutes", Duration.ofMinutes(15),  15,  "1m"),
    LAST_1H ("Last 1 hour",     Duration.ofHours(1),     30,  "2m"),
    LAST_3H ("Last 3 hours",    Duration.ofHours(3),     60,  "5m"),
    LAST_6H ("Last 6 hours",    Duration.ofHours(6),     120, "5m"),
    LAST_12H("Last 12 hours",   Duration.ofHours(12),    300, "10m"),
    LAST_24H("Last 24 hours",   Duration.ofDays(1),      600, "15m"),
    LAST_3D ("Last 3 days",     Duration.ofDays(3),      1800, "30m"),
    LAST_7D ("Last 7 days",     Duration.ofDays(7),      3600, "1h"),
    LAST_30D("Last 30 days",    Duration.ofDays(30),     14400, "4h");

    private final String label;
    private final Duration duration;
    private final long stepSeconds;
    private final String rateWindow;

    TimeRangePreset(String label, Duration duration, long stepSeconds, String rateWindow) {
        this.label = label;
        this.duration = duration;
        this.stepSeconds = stepSeconds;
        this.rateWindow = rateWindow;
    }
}

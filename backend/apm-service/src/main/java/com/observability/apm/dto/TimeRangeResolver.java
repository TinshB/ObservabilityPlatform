package com.observability.apm.dto;

import java.time.Duration;
import java.time.Instant;

/**
 * Resolves time-range parameters from either a named preset or custom values.
 * Auto-calculates step and rate window when not explicitly provided.
 */
public final class TimeRangeResolver {

    private TimeRangeResolver() {
    }

    /**
     * Resolve time-range parameters from a preset name, falling back to custom params.
     *
     * @param presetName  named preset (e.g. "LAST_1H"); null to use custom params
     * @param start       custom start (ISO-8601); ignored when preset is given
     * @param end         custom end   (ISO-8601); defaults to now
     * @param step        custom step in seconds; 0 means auto-calculate
     * @param rateWindow  custom rate window (e.g. "5m"); null means auto-calculate
     * @return resolved and validated TimeRangeRequest
     */
    public static TimeRangeRequest resolve(String presetName,
                                           Instant start, Instant end,
                                           long step, String rateWindow) {
        if (presetName != null && !presetName.isBlank()) {
            return resolveFromPreset(presetName);
        }
        return resolveCustom(start, end, step, rateWindow);
    }

    private static TimeRangeRequest resolveFromPreset(String presetName) {
        TimeRangePreset preset;
        try {
            preset = TimeRangePreset.valueOf(presetName.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Unknown time-range preset: " + presetName +
                    ". Valid values: " + java.util.Arrays.toString(TimeRangePreset.values()));
        }

        Instant now = Instant.now();
        return TimeRangeRequest.builder()
                .start(now.minus(preset.getDuration()))
                .end(now)
                .stepSeconds(preset.getStepSeconds())
                .rateWindow(preset.getRateWindow())
                .build();
    }

    private static TimeRangeRequest resolveCustom(Instant start, Instant end,
                                                   long step, String rateWindow) {
        Instant resolvedEnd = (end != null) ? end : Instant.now();
        Instant resolvedStart = (start != null) ? start : resolvedEnd.minus(Duration.ofHours(1));

        if (resolvedStart.isAfter(resolvedEnd)) {
            throw new IllegalArgumentException("start must be before end");
        }

        long rangeSecs = Duration.between(resolvedStart, resolvedEnd).toSeconds();
        long resolvedStep = (step > 0) ? step : autoStep(rangeSecs);
        String resolvedRateWindow = (rateWindow != null && !rateWindow.isBlank())
                ? rateWindow
                : autoRateWindow(resolvedStep);

        return TimeRangeRequest.builder()
                .start(resolvedStart)
                .end(resolvedEnd)
                .stepSeconds(resolvedStep)
                .rateWindow(resolvedRateWindow)
                .build();
    }

    /**
     * Auto-calculate step to yield ~120 data points.
     */
    static long autoStep(long rangeSeconds) {
        long step = rangeSeconds / 120;
        return Math.max(step, 15); // minimum 15s
    }

    /**
     * Auto-calculate rate window = 4× step (Prometheus best practice).
     */
    static String autoRateWindow(long stepSeconds) {
        long windowSeconds = stepSeconds * 4;
        if (windowSeconds >= 3600 && windowSeconds % 3600 == 0) {
            return (windowSeconds / 3600) + "h";
        }
        if (windowSeconds >= 60) {
            return (windowSeconds / 60) + "m";
        }
        return windowSeconds + "s";
    }
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Available time-range presets returned to the UI for dropdown population.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeRangePresetResponse {

    private String key;
    private String label;
    private long durationSeconds;
    private long stepSeconds;
    private String rateWindow;

    public static List<TimeRangePresetResponse> fromPresets() {
        List<TimeRangePresetResponse> list = new java.util.ArrayList<>();
        for (TimeRangePreset p : TimeRangePreset.values()) {
            list.add(TimeRangePresetResponse.builder()
                    .key(p.name())
                    .label(p.getLabel())
                    .durationSeconds(p.getDuration().toSeconds())
                    .stepSeconds(p.getStepSeconds())
                    .rateWindow(p.getRateWindow())
                    .build());
        }
        return list;
    }
}

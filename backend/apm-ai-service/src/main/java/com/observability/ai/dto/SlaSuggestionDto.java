package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.time.OffsetDateTime;

@Data
@Builder
public class SlaSuggestionDto {

    private int suggestedMaxDurationMs;
    private double suggestedMaxErrorRatePct;
    private AnalysisBasis basedOn;

    @Data
    @Builder
    public static class AnalysisBasis {
        private int tracesAnalyzed;
        private OffsetDateTime timeRangeStart;
        private OffsetDateTime timeRangeEnd;
        private LatencyStats latencyStats;
        private double observedErrorRate;
    }

    @Data
    @Builder
    public static class LatencyStats {
        private double p50Ms;
        private double p95Ms;
        private double p99Ms;
        private double avgMs;
    }
}

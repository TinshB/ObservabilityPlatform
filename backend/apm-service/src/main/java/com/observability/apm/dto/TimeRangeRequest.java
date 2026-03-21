package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Resolved and validated time-range parameters for Prometheus queries.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TimeRangeRequest {

    private Instant start;
    private Instant end;
    private long stepSeconds;
    private String rateWindow;
}

package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Page;

import java.util.Map;

/**
 * Story 11.1 — Alert history response DTO.
 * Wraps the paginated alert list with summary counts by state.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertHistoryResponse {

    /** Paginated alert records. */
    private Page<AlertResponse> alerts;

    /** Summary counts keyed by state (e.g. { "FIRING": 3, "RESOLVED": 12 }). */
    private Map<String, Long> stateCounts;

    /** Total alerts matching the filter (all states combined). */
    private long totalAlerts;
}

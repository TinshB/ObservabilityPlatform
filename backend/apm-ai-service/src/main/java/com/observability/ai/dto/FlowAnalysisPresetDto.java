package com.observability.ai.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class FlowAnalysisPresetDto {
    private UUID id;
    private String name;
    private List<UUID> serviceIds;
    private int defaultTimeRangeMinutes;
}

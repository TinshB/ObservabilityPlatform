package com.observability.ai.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Data
public class FlowAnalysisRequestDto {

    @NotEmpty(message = "At least 2 services must be selected")
    private List<UUID> serviceIds;

    @NotNull
    private OffsetDateTime timeRangeStart;

    @NotNull
    private OffsetDateTime timeRangeEnd;

    private String operationFilter;

    private int traceSampleLimit = 1000;

    private boolean includeDbCalls = true;

    private boolean includeExternalCalls = true;
}

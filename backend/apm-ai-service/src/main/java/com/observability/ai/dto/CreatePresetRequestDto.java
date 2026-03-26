package com.observability.ai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CreatePresetRequestDto {

    @NotBlank
    private String name;

    @NotEmpty
    private List<UUID> serviceIds;

    private int defaultTimeRangeMinutes = 60;
}

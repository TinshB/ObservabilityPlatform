package com.observability.apm.controller;

import com.observability.apm.dto.TimeRangePresetResponse;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/metrics")
@Tag(name = "Time Ranges", description = "Time-range preset discovery for metrics queries")
public class TimeRangeController {

    @GetMapping("/time-ranges")
    @Operation(summary = "List available time-range presets",
            description = "Returns all named presets with their duration, step, and rate window for UI dropdown population")
    public ResponseEntity<ApiResponse<List<TimeRangePresetResponse>>> getTimeRangePresets() {
        return ResponseEntity.ok(ApiResponse.success(TimeRangePresetResponse.fromPresets()));
    }
}

package com.observability.report.controller;

import com.observability.report.dto.CreateReportScheduleRequest;
import com.observability.report.dto.ReportScheduleResponse;
import com.observability.report.dto.UpdateReportScheduleRequest;
import com.observability.report.service.ReportScheduleService;
import com.observability.shared.dto.ApiResponse;
import com.observability.shared.dto.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/report-schedules")
@RequiredArgsConstructor
@Tag(name = "Report Schedules", description = "CRUD APIs for scheduled report email delivery")
public class ReportScheduleController {

    private final ReportScheduleService scheduleService;

    @PostMapping
    @Operation(summary = "Create a new report delivery schedule")
    public ResponseEntity<ApiResponse<ReportScheduleResponse>> createSchedule(
            @RequestBody @Valid CreateReportScheduleRequest request,
            Authentication authentication) {

        String createdBy = authentication.getName();
        ReportScheduleResponse response = scheduleService.createSchedule(request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(response));
    }

    @GetMapping
    @Operation(summary = "List all report schedules")
    public ResponseEntity<ApiResponse<PagedResponse<ReportScheduleResponse>>> listSchedules(
            @PageableDefault(size = 20) Pageable pageable) {

        var page = scheduleService.listSchedules(pageable);
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.from(page)));
    }

    @GetMapping("/{scheduleId}")
    @Operation(summary = "Get a report schedule by ID")
    public ResponseEntity<ApiResponse<ReportScheduleResponse>> getSchedule(
            @PathVariable UUID scheduleId) {

        ReportScheduleResponse response = scheduleService.getSchedule(scheduleId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{scheduleId}")
    @Operation(summary = "Update a report schedule")
    public ResponseEntity<ApiResponse<ReportScheduleResponse>> updateSchedule(
            @PathVariable UUID scheduleId,
            @RequestBody @Valid UpdateReportScheduleRequest request) {

        ReportScheduleResponse response = scheduleService.updateSchedule(scheduleId, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{scheduleId}")
    @Operation(summary = "Delete a report schedule")
    public ResponseEntity<ApiResponse<Void>> deleteSchedule(@PathVariable UUID scheduleId) {
        scheduleService.deleteSchedule(scheduleId);
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}

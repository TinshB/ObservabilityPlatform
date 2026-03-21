package com.observability.report.controller;

import com.observability.report.dto.GenerateReportRequest;
import com.observability.report.dto.ReportResponse;
import com.observability.report.entity.ReportStatus;
import com.observability.report.entity.ReportType;
import com.observability.report.service.ReportService;
import com.observability.shared.dto.ApiResponse;
import com.observability.shared.dto.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
@Tag(name = "Reports", description = "Report generation, listing, and download APIs")
public class ReportController {

    private final ReportService reportService;

    @PostMapping("/generate")
    @Operation(summary = "Trigger report generation",
            description = "Queues an async report generation job. Returns immediately with QUEUED status.")
    public ResponseEntity<ApiResponse<ReportResponse>> generateReport(
            @RequestBody @Valid GenerateReportRequest request,
            Authentication authentication) {

        String requestedBy = authentication.getName();
        ReportResponse response = reportService.generateReport(request, requestedBy);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(ApiResponse.created(response));
    }

    @GetMapping("/{reportId}")
    @Operation(summary = "Get report by ID")
    public ResponseEntity<ApiResponse<ReportResponse>> getReport(
            @PathVariable UUID reportId) {

        ReportResponse response = reportService.getReport(reportId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    @Operation(summary = "List reports with optional filters")
    public ResponseEntity<ApiResponse<PagedResponse<ReportResponse>>> listReports(
            @Parameter(description = "Filter by report type")
            @RequestParam(required = false) ReportType reportType,
            @Parameter(description = "Filter by report status")
            @RequestParam(required = false) ReportStatus status,
            @Parameter(description = "Filter by requester username")
            @RequestParam(required = false) String requestedBy,
            @PageableDefault(size = 20) Pageable pageable) {

        var page = reportService.listReports(reportType, status, requestedBy, pageable);
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.from(page)));
    }

    @GetMapping("/{reportId}/download")
    @Operation(summary = "Download a completed report PDF")
    public ResponseEntity<Resource> downloadReport(@PathVariable UUID reportId) {
        String filePath = reportService.getReportFilePath(reportId);
        File file = new File(filePath);

        Resource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + file.getName() + "\"")
                .contentLength(file.length())
                .body(resource);
    }

    @DeleteMapping("/{reportId}")
    @Operation(summary = "Delete a report and its associated file")
    public ResponseEntity<ApiResponse<Void>> deleteReport(@PathVariable UUID reportId) {
        reportService.deleteReport(reportId);
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}

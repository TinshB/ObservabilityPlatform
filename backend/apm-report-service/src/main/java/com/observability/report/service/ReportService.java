package com.observability.report.service;

import com.observability.report.dto.GenerateReportRequest;
import com.observability.report.dto.ReportResponse;
import com.observability.report.entity.ReportEntity;
import com.observability.report.entity.ReportFormat;
import com.observability.report.entity.ReportStatus;
import com.observability.report.entity.ReportType;
import com.observability.report.mapper.ReportMapper;
import com.observability.report.repository.ReportRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.UUID;

/**
 * Story 14.1 — Main Report Service.
 * Handles report CRUD, triggers async generation, and provides query capabilities.
 */

/**
 * Story 14.1 — Main Report Service.
 * Handles report CRUD, triggers async generation, and provides query capabilities.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final ReportGenerationService reportGenerationService;
    private final ReportMapper reportMapper;
    private final MinioStorageService minioStorageService;

    /**
     * Trigger async report generation. Returns immediately with QUEUED status.
     */
    @Transactional
    @CacheEvict(value = "reports", allEntries = true)
    public ReportResponse generateReport(GenerateReportRequest request, String requestedBy) {
        log.info("Queuing {} report '{}' requested by {}", request.getReportType(), request.getName(), requestedBy);

        ReportEntity report = ReportEntity.builder()
                .name(request.getName())
                .reportType(request.getReportType())
                .reportFormat(ReportFormat.PDF)
                .status(ReportStatus.QUEUED)
                .requestedBy(requestedBy)
                .serviceId(request.getServiceId())
                .serviceName(request.getServiceName())
                .timeRangeStart(request.getTimeRangeStart())
                .timeRangeEnd(request.getTimeRangeEnd())
                .build();

        report = reportRepository.save(report);

        // Trigger async generation AFTER the transaction commits,
        // so the record is visible to the async thread.
        UUID reportId = report.getId();
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                reportGenerationService.generateAsync(reportId);
            }
        });

        return reportMapper.toReportResponse(report);
    }

    /**
     * Get a report by ID.
     */
    @Transactional(readOnly = true)
    @Cacheable(value = "report-by-id", key = "#reportId")
    public ReportResponse getReport(UUID reportId) {
        ReportEntity report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found: " + reportId));
        return reportMapper.toReportResponse(report);
    }

    /**
     * List reports with optional filters.
     */
    @Transactional(readOnly = true)
    public Page<ReportResponse> listReports(ReportType reportType,
                                            ReportStatus status,
                                            String requestedBy,
                                            Pageable pageable) {
        Page<ReportEntity> page = reportRepository.findWithFilters(reportType, status, requestedBy, pageable);
        return page.map(reportMapper::toReportResponse);
    }

    /**
     * Get the file path for downloading a completed report.
     */
    @Transactional(readOnly = true)
    public String getReportFilePath(UUID reportId) {
        ReportEntity report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found: " + reportId));

        if (report.getStatus() != ReportStatus.COMPLETED) {
            throw new IllegalStateException("Report is not yet completed. Current status: " + report.getStatus());
        }

        if (report.getFilePath() == null) {
            throw new IllegalStateException("Report file not available");
        }

        return report.getFilePath();
    }

    /**
     * Delete a report record and its associated file.
     */
    @Transactional
    @CacheEvict(value = {"reports", "report-by-id"}, allEntries = true)
    public void deleteReport(UUID reportId) {
        ReportEntity report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Report not found: " + reportId));

        if (report.getFilePath() != null) {
            minioStorageService.delete(report.getFilePath());
        }

        reportRepository.delete(report);
        log.info("Deleted report {}", reportId);
    }
}

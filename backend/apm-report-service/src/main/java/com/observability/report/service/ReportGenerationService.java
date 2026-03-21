package com.observability.report.service;

import com.observability.report.dto.KpiReportData;
import com.observability.report.dto.PerformanceReportData;
import com.observability.report.entity.ReportEntity;
import com.observability.report.entity.ReportStatus;
import com.observability.report.entity.ReportType;
import com.observability.report.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.Instant;
import java.util.UUID;

/**
 * Story 14.1 — Async report generation service.
 * Orchestrates data gathering, PDF rendering, and status tracking.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportGenerationService {

    private final ReportRepository reportRepository;
    private final KpiReportGenerator kpiReportGenerator;
    private final PerformanceReportGenerator performanceReportGenerator;
    private final PdfRenderingService pdfRenderingService;

    /**
     * Asynchronously generate a report. Updates status in the database as it progresses.
     */
    @Async("reportGenerationExecutor")
    public void generateAsync(UUID reportId) {
        log.info("Starting async report generation for report {}", reportId);

        ReportEntity report = reportRepository.findById(reportId).orElse(null);
        if (report == null) {
            log.error("Report {} not found — cannot generate", reportId);
            return;
        }

        try {
            updateStatus(report, ReportStatus.GENERATING);

            String filePath;

            if (report.getReportType() == ReportType.KPI) {
                KpiReportData data = kpiReportGenerator.generate(
                        report.getName(),
                        report.getTimeRangeStart(),
                        report.getTimeRangeEnd(),
                        report.getServiceName());
                filePath = pdfRenderingService.renderKpiReport(data, reportId);
            } else {
                PerformanceReportData data = performanceReportGenerator.generate(
                        report.getName(),
                        report.getTimeRangeStart(),
                        report.getTimeRangeEnd(),
                        report.getServiceName());
                filePath = pdfRenderingService.renderPerformanceReport(data, reportId);
            }

            report.setFilePath(filePath);
            report.setFileSizeBytes(new File(filePath).length());
            report.setCompletedAt(Instant.now());
            updateStatus(report, ReportStatus.COMPLETED);

            log.info("Report {} generated successfully: {}", reportId, filePath);
        } catch (Exception e) {
            log.error("Report generation failed for report {}: {}", reportId, e.getMessage(), e);
            report.setErrorMessage(e.getMessage());
            updateStatus(report, ReportStatus.FAILED);
        }
    }

    @Transactional
    protected void updateStatus(ReportEntity report, ReportStatus status) {
        report.setStatus(status);
        reportRepository.save(report);
    }
}

package com.observability.report.service;

import com.observability.report.config.ReportProperties;
import com.observability.report.dto.KpiReportData;
import com.observability.report.dto.PerformanceReportData;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Story 14.4 — PDF Rendering Service.
 * Renders report data to HTML via Thymeleaf templates, then converts HTML to PDF.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PdfRenderingService {

    private final TemplateEngine templateEngine;
    private final ReportProperties reportProperties;

    /**
     * Render a KPI report as a PDF file. Returns the absolute file path.
     */
    public String renderKpiReport(KpiReportData data, UUID reportId) {
        log.info("Rendering KPI report PDF for report {}", reportId);

        Context context = new Context();
        context.setVariable("report", data);

        String html = templateEngine.process("kpi-report", context);
        return writePdf(html, reportId, "kpi");
    }

    /**
     * Render a Performance report as a PDF file. Returns the absolute file path.
     */
    public String renderPerformanceReport(PerformanceReportData data, UUID reportId) {
        log.info("Rendering Performance report PDF for report {}", reportId);

        Context context = new Context();
        context.setVariable("report", data);

        String html = templateEngine.process("performance-report", context);
        return writePdf(html, reportId, "performance");
    }

    private String writePdf(String html, UUID reportId, String type) {
        try {
            Path storageDir = Path.of(reportProperties.getStorageDir());
            Files.createDirectories(storageDir);

            String fileName = String.format("%s-%s.pdf", type, reportId);
            Path filePath = storageDir.resolve(fileName);

            try (OutputStream os = new FileOutputStream(filePath.toFile())) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(os);
                builder.run();
            }

            log.info("PDF written to {}", filePath);
            return filePath.toAbsolutePath().toString();
        } catch (Exception e) {
            log.error("Failed to render PDF for report {}: {}", reportId, e.getMessage(), e);
            throw new RuntimeException("PDF rendering failed: " + e.getMessage(), e);
        }
    }
}

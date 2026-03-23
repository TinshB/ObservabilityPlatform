package com.observability.report.service;

import com.observability.report.dto.KpiReportData;
import com.observability.report.dto.PerformanceReportData;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.util.UUID;

/**
 * Story 14.4 — PDF Rendering Service.
 * Renders report data to HTML via Thymeleaf templates, converts to PDF,
 * and uploads to MinIO object storage.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PdfRenderingService {

    private final TemplateEngine templateEngine;
    private final MinioStorageService minioStorageService;

    /**
     * Render a KPI report as a PDF and upload to MinIO. Returns the object key.
     */
    public String renderKpiReport(KpiReportData data, UUID reportId) {
        log.info("Rendering KPI report PDF for report {}", reportId);

        Context context = new Context();
        context.setVariable("report", data);

        String html = templateEngine.process("kpi-report", context);
        return renderAndUpload(html, reportId, "kpi");
    }

    /**
     * Render a Performance report as a PDF and upload to MinIO. Returns the object key.
     */
    public String renderPerformanceReport(PerformanceReportData data, UUID reportId) {
        log.info("Rendering Performance report PDF for report {}", reportId);

        Context context = new Context();
        context.setVariable("report", data);

        String html = templateEngine.process("performance-report", context);
        return renderAndUpload(html, reportId, "performance");
    }

    private String renderAndUpload(String html, UUID reportId, String type) {
        try {
            byte[] pdfBytes;
            try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                PdfRendererBuilder builder = new PdfRendererBuilder();
                builder.useFastMode();
                builder.withHtmlContent(html, null);
                builder.toStream(baos);
                builder.run();
                pdfBytes = baos.toByteArray();
            }

            String objectKey = String.format("reports/%s-%s.pdf", type, reportId);
            minioStorageService.upload(objectKey, pdfBytes);

            log.info("PDF uploaded to MinIO: {}", objectKey);
            return objectKey;
        } catch (Exception e) {
            log.error("Failed to render PDF for report {}: {}", reportId, e.getMessage(), e);
            throw new RuntimeException("PDF rendering failed: " + e.getMessage(), e);
        }
    }
}

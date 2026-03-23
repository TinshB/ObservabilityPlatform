package com.observability.report.service;

import com.observability.report.config.ReportProperties;
import com.observability.report.entity.ReportEntity;
import com.observability.report.entity.ReportType;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamSource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Story 14.4 — Email delivery service for scheduled report distribution.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailDeliveryService {

    private final JavaMailSender mailSender;
    private final ReportProperties reportProperties;
    private final MinioStorageService minioStorageService;

    /**
     * Send a generated report PDF to the specified recipients.
     */
    public void sendReport(ReportEntity report, List<String> recipients) {
        if (recipients == null || recipients.isEmpty()) {
            log.warn("No recipients specified for report {}", report.getId());
            return;
        }

        if (report.getFilePath() == null) {
            log.warn("No file path for report {} — cannot send email", report.getId());
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(reportProperties.getEmailFrom());
            helper.setTo(recipients.toArray(new String[0]));
            helper.setSubject(buildSubject(report));
            helper.setText(buildEmailBody(report), true);

            String objectKey = report.getFilePath();
            String fileName = objectKey.contains("/")
                    ? objectKey.substring(objectKey.lastIndexOf('/') + 1)
                    : objectKey;

            InputStreamSource attachment = () -> minioStorageService.getObject(objectKey);
            helper.addAttachment(fileName, attachment, "application/pdf");

            mailSender.send(message);
            log.info("Report {} sent to {} recipients", report.getId(), recipients.size());
        } catch (Exception e) {
            log.error("Failed to send report {} via email: {}", report.getId(), e.getMessage(), e);
            throw new RuntimeException("Email delivery failed: " + e.getMessage(), e);
        }
    }

    private String buildSubject(ReportEntity report) {
        String typeLabel = report.getReportType() == ReportType.KPI ? "KPI Report" : "Performance Report";
        return String.format("%s %s — %s", reportProperties.getEmailSubjectPrefix(), typeLabel, report.getName());
    }

    private String buildEmailBody(ReportEntity report) {
        String typeLabel = report.getReportType() == ReportType.KPI ? "KPI" : "Performance";
        return String.format("""
                <html>
                <body>
                    <h2>%s Report: %s</h2>
                    <p>Your scheduled <strong>%s</strong> report has been generated and is attached to this email.</p>
                    <p><strong>Time Range:</strong> %s to %s</p>
                    %s
                    <br/>
                    <p style="color: #888; font-size: 12px;">— Observability Platform</p>
                </body>
                </html>
                """,
                typeLabel,
                report.getName(),
                typeLabel,
                report.getTimeRangeStart(),
                report.getTimeRangeEnd(),
                report.getServiceName() != null ? "<p><strong>Service:</strong> " + report.getServiceName() + "</p>" : ""
        );
    }
}

package com.observability.report.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "report")
public class ReportProperties {

    /** Directory where generated PDF reports are stored. */
    private String storageDir = "/tmp/reports";

    /** Maximum number of days to retain generated reports. */
    private int retentionDays = 30;

    /** From address for email delivery. */
    private String emailFrom = "reports@observability-platform.local";

    /** Subject prefix for report emails. */
    private String emailSubjectPrefix = "[Observability Platform]";
}

package com.observability.report.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KpiReportData {

    private String reportName;
    private Instant generatedAt;
    private Instant timeRangeStart;
    private Instant timeRangeEnd;
    private String serviceName;

    private double overallSlaCompliancePct;
    private int totalAlerts;
    private int criticalAlerts;
    private int warningAlerts;
    private int infoAlerts;

    private List<SlaComplianceEntry> slaCompliance;
    private List<TopOffendingService> topOffendingServices;
    private List<AlertTrend> alertTrends;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SlaComplianceEntry {
        private String serviceName;
        private String slaRuleName;
        private double compliancePct;
        private int totalEvaluations;
        private int breaches;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TopOffendingService {
        private String serviceName;
        private int alertCount;
        private int criticalCount;
        private double avgResolutionMinutes;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AlertTrend {
        private String date;
        private int criticalCount;
        private int warningCount;
        private int infoCount;
    }
}

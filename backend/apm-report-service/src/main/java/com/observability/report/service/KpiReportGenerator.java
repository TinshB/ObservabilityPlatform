package com.observability.report.service;

import com.observability.report.dto.KpiReportData;
import com.observability.report.elasticsearch.ElasticsearchQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Story 14.2 — KPI Report Generator.
 * Aggregates SLA compliance, alert counts by severity, top offending services, and trend analysis.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KpiReportGenerator {

    private final ElasticsearchQueryService esQueryService;

    /**
     * Generate KPI report data for the given time range and optional service filter.
     */
    public KpiReportData generate(String reportName,
                                  Instant timeRangeStart,
                                  Instant timeRangeEnd,
                                  String serviceName) {
        log.info("Generating KPI report '{}' for range [{} - {}], service: {}",
                reportName, timeRangeStart, timeRangeEnd, serviceName);

        // Query SLA compliance data
        List<KpiReportData.SlaComplianceEntry> slaCompliance =
                esQueryService.querySlaCompliance(timeRangeStart, timeRangeEnd, serviceName);

        double overallCompliance = slaCompliance.isEmpty() ? 100.0 :
                slaCompliance.stream()
                        .mapToDouble(KpiReportData.SlaComplianceEntry::getCompliancePct)
                        .average()
                        .orElse(100.0);

        // Query alert counts by severity
        ElasticsearchQueryService.AlertCounts alertCounts =
                esQueryService.queryAlertCounts(timeRangeStart, timeRangeEnd, serviceName);

        // Query top offending services
        List<KpiReportData.TopOffendingService> topOffenders =
                esQueryService.queryTopOffendingServices(timeRangeStart, timeRangeEnd, 10);

        // Query alert trends (daily)
        List<KpiReportData.AlertTrend> alertTrends =
                esQueryService.queryAlertTrends(timeRangeStart, timeRangeEnd, serviceName);

        return KpiReportData.builder()
                .reportName(reportName)
                .generatedAt(Instant.now())
                .timeRangeStart(timeRangeStart)
                .timeRangeEnd(timeRangeEnd)
                .serviceName(serviceName)
                .overallSlaCompliancePct(overallCompliance)
                .totalAlerts(alertCounts.total())
                .criticalAlerts(alertCounts.critical())
                .warningAlerts(alertCounts.warning())
                .infoAlerts(alertCounts.info())
                .slaCompliance(slaCompliance)
                .topOffendingServices(topOffenders)
                .alertTrends(alertTrends)
                .build();
    }
}

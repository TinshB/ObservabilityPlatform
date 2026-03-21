package com.observability.report.service;

import com.observability.report.dto.KpiReportData;
import com.observability.report.elasticsearch.ElasticsearchQueryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KpiReportGeneratorTest {

    @Mock
    private ElasticsearchQueryService esQueryService;

    @InjectMocks
    private KpiReportGenerator kpiReportGenerator;

    @Test
    void generate_shouldAggregateAllKpiData() {
        Instant start = Instant.now().minusSeconds(86400);
        Instant end = Instant.now();

        when(esQueryService.querySlaCompliance(any(), any(), any()))
                .thenReturn(List.of(
                        KpiReportData.SlaComplianceEntry.builder()
                                .serviceName("order-service")
                                .slaRuleName("P99 < 500ms")
                                .compliancePct(98.5)
                                .totalEvaluations(1440)
                                .breaches(22)
                                .build()
                ));

        when(esQueryService.queryAlertCounts(any(), any(), any()))
                .thenReturn(new ElasticsearchQueryService.AlertCounts(42, 5, 15, 22));

        when(esQueryService.queryTopOffendingServices(any(), any(), eq(10)))
                .thenReturn(List.of(
                        KpiReportData.TopOffendingService.builder()
                                .serviceName("payment-service")
                                .alertCount(12)
                                .criticalCount(3)
                                .build()
                ));

        when(esQueryService.queryAlertTrends(any(), any(), any()))
                .thenReturn(List.of(
                        KpiReportData.AlertTrend.builder()
                                .date("2026-03-18")
                                .criticalCount(2)
                                .warningCount(5)
                                .infoCount(8)
                                .build()
                ));

        KpiReportData result = kpiReportGenerator.generate("Test KPI", start, end, "order-service");

        assertThat(result.getReportName()).isEqualTo("Test KPI");
        assertThat(result.getTotalAlerts()).isEqualTo(42);
        assertThat(result.getCriticalAlerts()).isEqualTo(5);
        assertThat(result.getOverallSlaCompliancePct()).isEqualTo(98.5);
        assertThat(result.getSlaCompliance()).hasSize(1);
        assertThat(result.getTopOffendingServices()).hasSize(1);
        assertThat(result.getAlertTrends()).hasSize(1);
    }

    @Test
    void generate_withNoData_shouldReturnDefaults() {
        Instant start = Instant.now().minusSeconds(86400);
        Instant end = Instant.now();

        when(esQueryService.querySlaCompliance(any(), any(), any())).thenReturn(List.of());
        when(esQueryService.queryAlertCounts(any(), any(), any()))
                .thenReturn(new ElasticsearchQueryService.AlertCounts(0, 0, 0, 0));
        when(esQueryService.queryTopOffendingServices(any(), any(), eq(10))).thenReturn(List.of());
        when(esQueryService.queryAlertTrends(any(), any(), any())).thenReturn(List.of());

        KpiReportData result = kpiReportGenerator.generate("Empty KPI", start, end, null);

        assertThat(result.getTotalAlerts()).isEqualTo(0);
        assertThat(result.getOverallSlaCompliancePct()).isEqualTo(100.0);
        assertThat(result.getSlaCompliance()).isEmpty();
    }
}

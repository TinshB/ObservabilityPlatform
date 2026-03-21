package com.observability.report.service;

import com.observability.report.dto.PerformanceReportData;
import com.observability.report.prometheus.PrometheusQueryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PerformanceReportGeneratorTest {

    @Mock
    private PrometheusQueryService prometheusQueryService;

    @InjectMocks
    private PerformanceReportGenerator performanceReportGenerator;

    @Test
    void generate_shouldAggregateAllPerformanceData() {
        Instant start = Instant.now().minusSeconds(86400);
        Instant end = Instant.now();

        when(prometheusQueryService.queryLatencySummary(anyString(), any(), any()))
                .thenReturn(PerformanceReportData.LatencySummary.builder()
                        .p50Ms(25.3).p95Ms(120.5).p99Ms(350.8).avgMs(45.2).build());

        when(prometheusQueryService.queryThroughputSummary(anyString(), any(), any()))
                .thenReturn(PerformanceReportData.ThroughputSummary.builder()
                        .avgRequestsPerSecond(150.0).peakRequestsPerSecond(450.0).totalRequests(1250000).build());

        when(prometheusQueryService.queryErrorBudget(anyString(), any(), any()))
                .thenReturn(PerformanceReportData.ErrorBudgetSummary.builder()
                        .errorRatePct(0.15).errorBudgetRemainingPct(99.85).totalErrors(1875).totalRequests(1250000).build());

        when(prometheusQueryService.queryInfraUtilisation(anyString(), any(), any()))
                .thenReturn(PerformanceReportData.InfraUtilisation.builder()
                        .avgCpuPct(35.2).peakCpuPct(78.5).avgMemoryPct(62.3).peakMemoryPct(88.1).build());

        when(prometheusQueryService.queryLatencyTrends(anyString(), any(), any(), anyString()))
                .thenReturn(List.of());

        when(prometheusQueryService.queryThroughputTrends(anyString(), any(), any(), anyString()))
                .thenReturn(List.of());

        PerformanceReportData result = performanceReportGenerator.generate(
                "Test Perf", start, end, "order-service");

        assertThat(result.getReportName()).isEqualTo("Test Perf");
        assertThat(result.getLatencySummary().getP50Ms()).isEqualTo(25.3);
        assertThat(result.getThroughputSummary().getTotalRequests()).isEqualTo(1250000);
        assertThat(result.getErrorBudgetSummary().getErrorRatePct()).isEqualTo(0.15);
        assertThat(result.getInfraUtilisation().getAvgCpuPct()).isEqualTo(35.2);
    }
}

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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {

    @Mock
    private ReportRepository reportRepository;

    @Mock
    private ReportGenerationService reportGenerationService;

    @Mock
    private ReportMapper reportMapper;

    @InjectMocks
    private ReportService reportService;

    @Test
    void generateReport_shouldSaveAndTriggerAsyncGeneration() {
        GenerateReportRequest request = GenerateReportRequest.builder()
                .name("KPI Report Q1")
                .reportType(ReportType.KPI)
                .timeRangeStart(Instant.now().minusSeconds(86400))
                .timeRangeEnd(Instant.now())
                .build();

        UUID reportId = UUID.randomUUID();
        ReportEntity savedEntity = ReportEntity.builder()
                .id(reportId)
                .name("KPI Report Q1")
                .reportType(ReportType.KPI)
                .reportFormat(ReportFormat.PDF)
                .status(ReportStatus.QUEUED)
                .requestedBy("admin")
                .build();

        ReportResponse expectedResponse = ReportResponse.builder()
                .id(reportId)
                .name("KPI Report Q1")
                .reportType(ReportType.KPI)
                .status(ReportStatus.QUEUED)
                .build();

        when(reportRepository.save(any(ReportEntity.class))).thenReturn(savedEntity);
        when(reportMapper.toReportResponse(savedEntity)).thenReturn(expectedResponse);

        ReportResponse result = reportService.generateReport(request, "admin");

        assertThat(result.getId()).isEqualTo(reportId);
        assertThat(result.getStatus()).isEqualTo(ReportStatus.QUEUED);
        verify(reportGenerationService).generateAsync(reportId);
    }

    @Test
    void getReport_shouldReturnReport() {
        UUID reportId = UUID.randomUUID();
        ReportEntity entity = ReportEntity.builder()
                .id(reportId)
                .name("Test Report")
                .status(ReportStatus.COMPLETED)
                .build();

        ReportResponse expectedResponse = ReportResponse.builder()
                .id(reportId)
                .name("Test Report")
                .status(ReportStatus.COMPLETED)
                .build();

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(entity));
        when(reportMapper.toReportResponse(entity)).thenReturn(expectedResponse);

        ReportResponse result = reportService.getReport(reportId);

        assertThat(result.getName()).isEqualTo("Test Report");
        assertThat(result.getStatus()).isEqualTo(ReportStatus.COMPLETED);
    }

    @Test
    void getReport_notFound_shouldThrow() {
        UUID reportId = UUID.randomUUID();
        when(reportRepository.findById(reportId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reportService.getReport(reportId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining(reportId.toString());
    }

    @Test
    void getReportFilePath_notCompleted_shouldThrow() {
        UUID reportId = UUID.randomUUID();
        ReportEntity entity = ReportEntity.builder()
                .id(reportId)
                .status(ReportStatus.GENERATING)
                .build();

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> reportService.getReportFilePath(reportId))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not yet completed");
    }
}

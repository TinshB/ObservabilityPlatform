package com.observability.report.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.report.dto.GenerateReportRequest;
import com.observability.report.dto.ReportResponse;
import com.observability.report.entity.ReportFormat;
import com.observability.report.entity.ReportStatus;
import com.observability.report.entity.ReportType;
import com.observability.report.security.JwtAuthenticationFilter;
import com.observability.report.security.JwtConfig;
import com.observability.report.security.JwtTokenProvider;
import com.observability.report.security.SecurityConfig;
import com.observability.report.service.ReportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ReportController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
@ActiveProfiles("test")
class ReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ReportService reportService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @MockitoBean
    private JwtConfig jwtConfig;

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void generateReport_shouldReturnAccepted() throws Exception {
        GenerateReportRequest request = GenerateReportRequest.builder()
                .name("Weekly KPI Report")
                .reportType(ReportType.KPI)
                .timeRangeStart(Instant.now().minusSeconds(86400))
                .timeRangeEnd(Instant.now())
                .build();

        UUID reportId = UUID.randomUUID();
        ReportResponse response = ReportResponse.builder()
                .id(reportId)
                .name("Weekly KPI Report")
                .reportType(ReportType.KPI)
                .reportFormat(ReportFormat.PDF)
                .status(ReportStatus.QUEUED)
                .requestedBy("admin")
                .build();

        when(reportService.generateReport(any(GenerateReportRequest.class), eq("admin")))
                .thenReturn(response);

        mockMvc.perform(post("/api/v1/reports/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(reportId.toString()))
                .andExpect(jsonPath("$.data.status").value("QUEUED"));
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void getReport_shouldReturnReport() throws Exception {
        UUID reportId = UUID.randomUUID();
        ReportResponse response = ReportResponse.builder()
                .id(reportId)
                .name("Test Report")
                .reportType(ReportType.PERFORMANCE)
                .reportFormat(ReportFormat.PDF)
                .status(ReportStatus.COMPLETED)
                .requestedBy("admin")
                .build();

        when(reportService.getReport(reportId)).thenReturn(response);

        mockMvc.perform(get("/api/v1/reports/{reportId}", reportId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(reportId.toString()))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"));
    }

    @Test
    void generateReport_withoutAuth_shouldReturn401() throws Exception {
        GenerateReportRequest request = GenerateReportRequest.builder()
                .name("Test")
                .reportType(ReportType.KPI)
                .timeRangeStart(Instant.now().minusSeconds(86400))
                .timeRangeEnd(Instant.now())
                .build();

        mockMvc.perform(post("/api/v1/reports/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}

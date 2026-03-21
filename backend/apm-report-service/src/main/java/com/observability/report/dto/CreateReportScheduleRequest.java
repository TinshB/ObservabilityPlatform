package com.observability.report.dto;

import com.observability.report.entity.ReportType;
import com.observability.report.entity.ScheduleFrequency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateReportScheduleRequest {

    @NotBlank(message = "Schedule name is required")
    private String name;

    @NotNull(message = "Report type is required")
    private ReportType reportType;

    @NotNull(message = "Frequency is required")
    private ScheduleFrequency frequency;

    @NotEmpty(message = "At least one recipient email is required")
    private List<String> recipients;

    private UUID serviceId;

    private String serviceName;
}

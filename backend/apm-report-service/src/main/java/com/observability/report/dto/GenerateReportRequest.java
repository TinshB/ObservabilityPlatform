package com.observability.report.dto;

import com.observability.report.entity.ReportType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerateReportRequest {

    @NotBlank(message = "Report name is required")
    private String name;

    @NotNull(message = "Report type is required")
    private ReportType reportType;

    private UUID serviceId;

    private String serviceName;

    @NotNull(message = "Time range start is required")
    private Instant timeRangeStart;

    @NotNull(message = "Time range end is required")
    private Instant timeRangeEnd;
}

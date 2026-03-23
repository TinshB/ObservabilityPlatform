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

    /** Hour of the day to run (0-23 UTC). Defaults to 6. */
    private Integer scheduleHour;

    /** Minute of the hour to run (0-59). Defaults to 0. */
    private Integer scheduleMinute;

    /** Day of week for WEEKLY frequency (1=MON..7=SUN). Defaults to 1 (Monday). */
    private Integer dayOfWeek;

    /** Day of month for MONTHLY frequency (1-28). Defaults to 1. */
    private Integer dayOfMonth;

    private UUID serviceId;

    private String serviceName;
}

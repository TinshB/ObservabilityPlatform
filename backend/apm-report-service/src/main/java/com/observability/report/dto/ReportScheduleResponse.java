package com.observability.report.dto;

import com.observability.report.entity.ReportType;
import com.observability.report.entity.ScheduleFrequency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportScheduleResponse {

    private UUID id;
    private String name;
    private ReportType reportType;
    private ScheduleFrequency frequency;
    private String cronExpression;
    private short scheduleHour;
    private short scheduleMinute;
    private Short dayOfWeek;
    private Short dayOfMonth;
    private List<String> recipients;
    private UUID serviceId;
    private String serviceName;
    private boolean active;
    private String createdBy;
    private Instant lastRunAt;
    private Instant nextRunAt;
    private Instant createdAt;
}

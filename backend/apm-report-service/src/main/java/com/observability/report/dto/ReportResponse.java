package com.observability.report.dto;

import com.observability.report.entity.ReportFormat;
import com.observability.report.entity.ReportStatus;
import com.observability.report.entity.ReportType;
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
public class ReportResponse {

    private UUID id;
    private String name;
    private ReportType reportType;
    private ReportFormat reportFormat;
    private ReportStatus status;
    private String requestedBy;
    private UUID serviceId;
    private String serviceName;
    private Instant timeRangeStart;
    private Instant timeRangeEnd;
    private Long fileSizeBytes;
    private String errorMessage;
    private Instant createdAt;
    private Instant completedAt;
}

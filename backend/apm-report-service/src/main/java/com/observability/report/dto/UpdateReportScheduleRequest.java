package com.observability.report.dto;

import com.observability.report.entity.ScheduleFrequency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateReportScheduleRequest {

    private String name;

    private ScheduleFrequency frequency;

    private List<String> recipients;

    private Boolean active;
}

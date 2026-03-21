package com.observability.report.mapper;

import com.observability.report.dto.ReportResponse;
import com.observability.report.dto.ReportScheduleResponse;
import com.observability.report.entity.ReportEntity;
import com.observability.report.entity.ReportScheduleEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import java.util.Arrays;
import java.util.List;

@Mapper(componentModel = "spring")
public interface ReportMapper {

    ReportResponse toReportResponse(ReportEntity entity);

    @Mapping(target = "recipients", source = "recipients", qualifiedByName = "csvToList")
    ReportScheduleResponse toScheduleResponse(ReportScheduleEntity entity);

    @Named("csvToList")
    default List<String> csvToList(String recipients) {
        if (recipients == null || recipients.isBlank()) {
            return List.of();
        }
        return Arrays.stream(recipients.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    @Named("listToCsv")
    default String listToCsv(List<String> recipients) {
        if (recipients == null || recipients.isEmpty()) {
            return "";
        }
        return String.join(",", recipients);
    }
}

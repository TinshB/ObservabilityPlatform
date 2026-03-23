package com.observability.report.service;

import com.observability.report.dto.CreateReportScheduleRequest;
import com.observability.report.dto.ReportScheduleResponse;
import com.observability.report.dto.UpdateReportScheduleRequest;
import com.observability.report.entity.ReportScheduleEntity;
import com.observability.report.entity.ScheduleFrequency;
import com.observability.report.mapper.ReportMapper;
import com.observability.report.repository.ReportScheduleRepository;
import com.observability.shared.exception.ConflictException;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Story 14.4 — Report Schedule CRUD service.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportScheduleService {

    private final ReportScheduleRepository scheduleRepository;
    private final ReportMapper reportMapper;

    @Transactional
    @CacheEvict(value = "report-schedules", allEntries = true)
    public ReportScheduleResponse createSchedule(CreateReportScheduleRequest request, String createdBy) {
        if (scheduleRepository.existsByNameAndCreatedBy(request.getName(), createdBy)) {
            throw new ConflictException("Schedule with name '" + request.getName() + "' already exists");
        }

        short hour = (short) (request.getScheduleHour() != null ? request.getScheduleHour() : 6);
        short minute = (short) (request.getScheduleMinute() != null ? request.getScheduleMinute() : 0);
        Short dow = request.getDayOfWeek() != null ? request.getDayOfWeek().shortValue() : null;
        Short dom = request.getDayOfMonth() != null ? request.getDayOfMonth().shortValue() : null;

        String cronExpression = buildCron(request.getFrequency(), hour, minute, dow, dom);

        ReportScheduleEntity schedule = ReportScheduleEntity.builder()
                .name(request.getName())
                .reportType(request.getReportType())
                .frequency(request.getFrequency())
                .cronExpression(cronExpression)
                .scheduleHour(hour)
                .scheduleMinute(minute)
                .dayOfWeek(dow)
                .dayOfMonth(dom)
                .recipients(String.join(",", request.getRecipients()))
                .serviceId(request.getServiceId())
                .serviceName(request.getServiceName())
                .active(true)
                .createdBy(createdBy)
                .build();

        schedule = scheduleRepository.save(schedule);
        log.info("Created report schedule '{}' by {}", request.getName(), createdBy);

        return reportMapper.toScheduleResponse(schedule);
    }

    @Transactional(readOnly = true)
    public Page<ReportScheduleResponse> listSchedules(Pageable pageable) {
        return scheduleRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(reportMapper::toScheduleResponse);
    }

    @Transactional(readOnly = true)
    public ReportScheduleResponse getSchedule(UUID scheduleId) {
        ReportScheduleEntity schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("Report schedule not found: " + scheduleId));
        return reportMapper.toScheduleResponse(schedule);
    }

    @Transactional
    @CacheEvict(value = "report-schedules", allEntries = true)
    public ReportScheduleResponse updateSchedule(UUID scheduleId, UpdateReportScheduleRequest request) {
        ReportScheduleEntity schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new ResourceNotFoundException("Report schedule not found: " + scheduleId));

        if (request.getName() != null) {
            schedule.setName(request.getName());
        }
        if (request.getScheduleHour() != null) {
            schedule.setScheduleHour(request.getScheduleHour().shortValue());
        }
        if (request.getScheduleMinute() != null) {
            schedule.setScheduleMinute(request.getScheduleMinute().shortValue());
        }
        if (request.getDayOfWeek() != null) {
            schedule.setDayOfWeek(request.getDayOfWeek().shortValue());
        }
        if (request.getDayOfMonth() != null) {
            schedule.setDayOfMonth(request.getDayOfMonth().shortValue());
        }
        if (request.getFrequency() != null) {
            schedule.setFrequency(request.getFrequency());
        }
        // Rebuild cron from current state
        schedule.setCronExpression(buildCron(
                schedule.getFrequency(), schedule.getScheduleHour(), schedule.getScheduleMinute(),
                schedule.getDayOfWeek(), schedule.getDayOfMonth()));
        if (request.getRecipients() != null && !request.getRecipients().isEmpty()) {
            schedule.setRecipients(String.join(",", request.getRecipients()));
        }
        if (request.getActive() != null) {
            schedule.setActive(request.getActive());
        }

        schedule = scheduleRepository.save(schedule);
        log.info("Updated report schedule {}", scheduleId);

        return reportMapper.toScheduleResponse(schedule);
    }

    @Transactional
    @CacheEvict(value = "report-schedules", allEntries = true)
    public void deleteSchedule(UUID scheduleId) {
        if (!scheduleRepository.existsById(scheduleId)) {
            throw new ResourceNotFoundException("Report schedule not found: " + scheduleId);
        }
        scheduleRepository.deleteById(scheduleId);
        log.info("Deleted report schedule {}", scheduleId);
    }

    @Transactional(readOnly = true)
    public List<ReportScheduleEntity> getActiveSchedules() {
        return scheduleRepository.findByActiveTrue();
    }

    private static final String[] CRON_DAYS = {"", "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"};

    /**
     * Build a cron expression from frequency + custom time/day selections.
     */
    private String buildCron(ScheduleFrequency frequency, short hour, short minute,
                              Short dayOfWeek, Short dayOfMonth) {
        return switch (frequency) {
            case DAILY -> String.format("0 %d %d * * *", minute, hour);
            case WEEKLY -> {
                String dow = (dayOfWeek != null && dayOfWeek >= 1 && dayOfWeek <= 7)
                        ? CRON_DAYS[dayOfWeek] : "MON";
                yield String.format("0 %d %d * * %s", minute, hour, dow);
            }
            case MONTHLY -> {
                int dom = (dayOfMonth != null && dayOfMonth >= 1 && dayOfMonth <= 28)
                        ? dayOfMonth : 1;
                yield String.format("0 %d %d %d * *", minute, hour, dom);
            }
        };
    }
}

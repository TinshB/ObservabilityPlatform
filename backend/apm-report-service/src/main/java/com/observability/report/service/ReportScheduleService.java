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

        String cronExpression = frequencyToCron(request.getFrequency());

        ReportScheduleEntity schedule = ReportScheduleEntity.builder()
                .name(request.getName())
                .reportType(request.getReportType())
                .frequency(request.getFrequency())
                .cronExpression(cronExpression)
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
        if (request.getFrequency() != null) {
            schedule.setFrequency(request.getFrequency());
            schedule.setCronExpression(frequencyToCron(request.getFrequency()));
        }
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

    /**
     * Convert a ScheduleFrequency enum to a cron expression.
     */
    private String frequencyToCron(ScheduleFrequency frequency) {
        return switch (frequency) {
            case DAILY -> "0 0 6 * * *";    // Every day at 06:00 UTC
            case WEEKLY -> "0 0 6 * * MON";  // Every Monday at 06:00 UTC
            case MONTHLY -> "0 0 6 1 * *";   // First of every month at 06:00 UTC
        };
    }
}

package com.observability.report.service;

import com.observability.report.dto.GenerateReportRequest;
import com.observability.report.dto.ReportResponse;
import com.observability.report.entity.ReportEntity;
import com.observability.report.entity.ReportScheduleEntity;
import com.observability.report.entity.ReportStatus;
import com.observability.report.repository.ReportRepository;
import com.observability.report.repository.ReportScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;

/**
 * Story 14.4 — Scheduled report generation and email delivery.
 * Evaluates active schedules periodically and triggers report generation + email.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportSchedulerService {

    private final ReportScheduleService scheduleService;
    private final ReportScheduleRepository scheduleRepository;
    private final ReportService reportService;
    private final ReportRepository reportRepository;
    private final EmailDeliveryService emailDeliveryService;

    /**
     * Runs every minute to check if any scheduled reports need to be generated.
     */
    @Scheduled(fixedDelayString = "${report.scheduler.check-interval-ms:60000}")
    @Transactional
    public void evaluateSchedules() {
        List<ReportScheduleEntity> activeSchedules = scheduleService.getActiveSchedules();

        if (activeSchedules.isEmpty()) {
            return;
        }

        Instant now = Instant.now();

        for (ReportScheduleEntity schedule : activeSchedules) {
            try {
                if (shouldRun(schedule, now)) {
                    executeSchedule(schedule, now);
                }
            } catch (Exception e) {
                log.error("Failed to evaluate schedule {}: {}", schedule.getId(), e.getMessage(), e);
            }
        }
    }

    /**
     * After a report completes, check if it was from a scheduled run and send email.
     */
    @Scheduled(fixedDelayString = "${report.scheduler.delivery-check-interval-ms:30000}")
    @Transactional
    public void deliverCompletedReports() {
        List<ReportEntity> completedReports = reportRepository
                .findByStatusAndCreatedAtBefore(ReportStatus.COMPLETED, Instant.now());

        for (ReportEntity report : completedReports) {
            // Check if this report was triggered by a schedule (name starts with "[Scheduled]")
            if (report.getName().startsWith("[Scheduled]") && report.getFilePath() != null) {
                try {
                    // Find the matching schedule to get recipients
                    scheduleRepository.findAll().stream()
                            .filter(s -> report.getName().contains(s.getName()))
                            .findFirst()
                            .ifPresent(schedule -> {
                                List<String> recipients = Arrays.stream(schedule.getRecipients().split(","))
                                        .map(String::trim)
                                        .filter(s -> !s.isEmpty())
                                        .toList();
                                emailDeliveryService.sendReport(report, recipients);
                            });
                } catch (Exception e) {
                    log.error("Failed to deliver report {} via email: {}", report.getId(), e.getMessage(), e);
                }
            }
        }
    }

    private boolean shouldRun(ReportScheduleEntity schedule, Instant now) {
        try {
            CronExpression cron = CronExpression.parse(schedule.getCronExpression());
            LocalDateTime lastRun = schedule.getLastRunAt() != null
                    ? LocalDateTime.ofInstant(schedule.getLastRunAt(), ZoneOffset.UTC)
                    : LocalDateTime.ofInstant(schedule.getCreatedAt(), ZoneOffset.UTC);

            LocalDateTime nextExecution = cron.next(lastRun);
            if (nextExecution != null) {
                Instant nextExecutionInstant = nextExecution.toInstant(ZoneOffset.UTC);
                schedule.setNextRunAt(nextExecutionInstant);

                return now.isAfter(nextExecutionInstant) || now.equals(nextExecutionInstant);
            }
        } catch (Exception e) {
            log.warn("Invalid cron expression for schedule {}: {}", schedule.getId(), e.getMessage());
        }
        return false;
    }

    private void executeSchedule(ReportScheduleEntity schedule, Instant now) {
        log.info("Executing scheduled report: {} (type: {}, frequency: {})",
                schedule.getName(), schedule.getReportType(), schedule.getFrequency());

        Instant timeRangeEnd = now;
        Instant timeRangeStart = switch (schedule.getFrequency()) {
            case DAILY -> now.minus(1, ChronoUnit.DAYS);
            case WEEKLY -> now.minus(7, ChronoUnit.DAYS);
            case MONTHLY -> now.minus(30, ChronoUnit.DAYS);
        };

        GenerateReportRequest request = GenerateReportRequest.builder()
                .name("[Scheduled] " + schedule.getName())
                .reportType(schedule.getReportType())
                .serviceId(schedule.getServiceId())
                .serviceName(schedule.getServiceName())
                .timeRangeStart(timeRangeStart)
                .timeRangeEnd(timeRangeEnd)
                .build();

        ReportResponse report = reportService.generateReport(request, schedule.getCreatedBy());
        log.info("Scheduled report queued with ID: {}", report.getId());

        // Update last run time
        schedule.setLastRunAt(now);
        scheduleRepository.save(schedule);
    }
}

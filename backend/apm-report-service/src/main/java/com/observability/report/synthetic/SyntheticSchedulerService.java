package com.observability.report.synthetic;

import com.observability.report.entity.SyntheticCheckEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Story 14.6 — Evaluates active synthetic check cron schedules and dispatches probes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyntheticSchedulerService {

    private final SyntheticCheckService checkService;
    private final SyntheticProberService proberService;

    /** Tracks last execution time per check to avoid duplicate runs. */
    private final Map<UUID, LocalDateTime> lastExecutionMap = new ConcurrentHashMap<>();

    @Scheduled(fixedDelayString = "${synthetic.scheduler.check-interval-ms:30000}")
    public void evaluateChecks() {
        List<SyntheticCheckEntity> activeChecks = checkService.getActiveChecks();

        if (activeChecks.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now(ZoneOffset.UTC);

        for (SyntheticCheckEntity check : activeChecks) {
            try {
                if (shouldExecute(check, now)) {
                    proberService.executeProbe(check);
                    lastExecutionMap.put(check.getId(), now);
                }
            } catch (Exception e) {
                log.error("Failed to evaluate synthetic check {}: {}", check.getId(), e.getMessage());
            }
        }
    }

    private boolean shouldExecute(SyntheticCheckEntity check, LocalDateTime now) {
        try {
            CronExpression cron = CronExpression.parse(check.getScheduleCron());
            LocalDateTime lastRun = lastExecutionMap.getOrDefault(check.getId(),
                    now.minusMinutes(60));

            LocalDateTime nextExecution = cron.next(lastRun);
            return nextExecution != null && !now.isBefore(nextExecution);
        } catch (Exception e) {
            log.warn("Invalid cron '{}' for check {}: {}", check.getScheduleCron(), check.getId(), e.getMessage());
            return false;
        }
    }
}

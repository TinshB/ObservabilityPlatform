package com.observability.apm.service;

import com.observability.apm.entity.AlertEntity;
import com.observability.apm.entity.SlaRuleEntity;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.notification.NotificationService;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import com.observability.apm.elasticsearch.ElasticsearchLogClient;
import com.observability.apm.repository.AlertRepository;
import com.observability.apm.repository.SlaRuleRepository;
import com.observability.apm.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Story 10.2 / 10.3 — Alert Engine core.
 * Runs on a configurable schedule (default 60s), evaluates all enabled SLA rules
 * against Prometheus (METRICS) or Elasticsearch (LOGS), and creates/transitions alerts.
 */
@Slf4j
@Service
@EnableScheduling
@RequiredArgsConstructor
public class AlertEngineService {

    private final SlaRuleRepository slaRuleRepository;
    private final AlertRepository alertRepository;
    private final ServiceRepository serviceRepository;
    private final PrometheusClient prometheusClient;
    private final ElasticsearchLogClient elasticsearchLogClient;
    private final NotificationService notificationService;
    private final AlertGroupingService alertGroupingService;

    /**
     * Main evaluation loop — runs every 60 seconds.
     * Finds all enabled SLA rules, evaluates each one, then applies
     * Story 11.2 grouping + suppression before dispatching notifications.
     */
    @Scheduled(fixedDelayString = "${alert.evaluation-interval-ms:60000}")
    @Transactional
    public void evaluateAllRules() {
        List<SlaRuleEntity> enabledRules = slaRuleRepository.findByEnabledTrue();
        if (enabledRules.isEmpty()) return;

        log.debug("Alert engine evaluating {} enabled SLA rules", enabledRules.size());

        // Collect all alerts that transition to FIRING in this cycle
        List<AlertGroupingService.AlertRulePair> newlyFired = new ArrayList<>();

        for (SlaRuleEntity rule : enabledRules) {
            try {
                AlertEntity firedAlert = evaluateRule(rule);
                if (firedAlert != null) {
                    newlyFired.add(new AlertGroupingService.AlertRulePair(firedAlert, rule));
                }
            } catch (Exception e) {
                log.error("Failed to evaluate SLA rule '{}' (id={}): {}", rule.getName(), rule.getId(), e.getMessage());
            }
        }

        // Story 11.2: Apply suppression → grouping → dispatch
        if (!newlyFired.isEmpty()) {
            dispatchWithGroupingAndSuppression(newlyFired);
        }
    }

    /**
     * Evaluate a single SLA rule.
     * @return the AlertEntity if it transitioned to FIRING in this cycle, or null otherwise
     */
    private AlertEntity evaluateRule(SlaRuleEntity rule) {
        String serviceName = serviceRepository.findById(rule.getServiceId())
                .map(ServiceEntity::getName)
                .orElse(null);
        if (serviceName == null) {
            log.warn("Service not found for SLA rule '{}' (serviceId={})", rule.getName(), rule.getServiceId());
            return null;
        }

        Double evaluatedValue;
        if ("METRICS".equals(rule.getSignalType())) {
            evaluatedValue = evaluateMetricsRule(rule, serviceName);
        } else if ("LOGS".equals(rule.getSignalType())) {
            evaluatedValue = evaluateLogsRule(rule, serviceName);
        } else {
            log.warn("Unknown signal type '{}' for SLA rule '{}'", rule.getSignalType(), rule.getName());
            return null;
        }

        if (evaluatedValue == null) {
            log.debug("No data returned for SLA rule '{}' — skipping evaluation", rule.getName());
            return null;
        }

        boolean breached = isThresholdBreached(evaluatedValue, rule.getOperator(), rule.getThreshold());
        return processAlertState(rule, evaluatedValue, breached);
    }

    // ── Story 10.2: PromQL Metrics Evaluator ────────────────────────────────────

    /**
     * Evaluate a METRICS SLA rule by running a PromQL instant query.
     *
     * @param rule        the SLA rule
     * @param serviceName the resolved service name
     * @return the evaluated metric value, or null if no data
     */
    private Double evaluateMetricsRule(SlaRuleEntity rule, String serviceName) {
        String promQL = buildPromQL(rule, serviceName);
        log.debug("Evaluating PromQL for rule '{}': {}", rule.getName(), promQL);

        PrometheusResponse response = prometheusClient.query(promQL);

        if (response == null || response.getData() == null
                || response.getData().getResult() == null
                || response.getData().getResult().isEmpty()) {
            return null;
        }

        // Extract scalar value from the first result
        PrometheusResponse.PromResult first = response.getData().getResult().getFirst();
        if (first.getValue() != null && first.getValue().size() >= 2) {
            try {
                return Double.parseDouble(first.getValue().get(1).toString());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    /**
     * Build a PromQL instant query from the SLA rule's metricName and evaluation window.
     * Supports common metric patterns:
     * <ul>
     *   <li>p99_latency → histogram_quantile(0.99, sum by(le)(rate(http_server_request_duration_seconds_bucket{job="svc"}[window])))</li>
     *   <li>p95_latency → same with 0.95</li>
     *   <li>error_rate  → sum(rate(http_server_request_duration_seconds_count{job="svc",http_response_status_code=~"5.."}[window])) / sum(rate(count{job}[window]))</li>
     *   <li>request_rate → sum(rate(http_server_request_duration_seconds_count{job="svc"}[window]))</li>
     *   <li>Otherwise   → treat metricName as raw PromQL expression</li>
     * </ul>
     */
    private String buildPromQL(SlaRuleEntity rule, String serviceName) {
        String window = rule.getEvaluationWindow();
        String metric = rule.getMetricName();

        return switch (metric) {
            case "p99_latency" -> String.format(
                    "histogram_quantile(0.99, sum by(le)(rate(http_server_request_duration_seconds_bucket{job=\"%s\"}[%s])))",
                    serviceName, window);
            case "p95_latency" -> String.format(
                    "histogram_quantile(0.95, sum by(le)(rate(http_server_request_duration_seconds_bucket{job=\"%s\"}[%s])))",
                    serviceName, window);
            case "p50_latency" -> String.format(
                    "histogram_quantile(0.50, sum by(le)(rate(http_server_request_duration_seconds_bucket{job=\"%s\"}[%s])))",
                    serviceName, window);
            case "error_rate" -> String.format(
                    "sum(rate(http_server_request_duration_seconds_count{job=\"%s\",http_response_status_code=~\"5..\"}[%s])) / sum(rate(http_server_request_duration_seconds_count{job=\"%s\"}[%s]))",
                    serviceName, window, serviceName, window);
            case "request_rate" -> String.format(
                    "sum(rate(http_server_request_duration_seconds_count{job=\"%s\"}[%s]))",
                    serviceName, window);
            default -> metric; // Treat as raw PromQL
        };
    }

    // ── Story 10.3: Elasticsearch Log Evaluator ─────────────────────────────────

    /**
     * Evaluate a LOGS SLA rule by running an Elasticsearch aggregation.
     * <p>Supports log conditions:
     * <ul>
     *   <li>error_count       → count of ERROR/FATAL log entries in the evaluation window</li>
     *   <li>error_ratio        → ratio of ERROR+FATAL to total logs</li>
     *   <li>total_log_volume   → total log count in the evaluation window</li>
     *   <li>Otherwise          → count of logs matching the logCondition as a severity filter</li>
     * </ul>
     *
     * @param rule        the SLA rule
     * @param serviceName the resolved service name
     * @return the evaluated value, or null if no data
     */
    private Double evaluateLogsRule(SlaRuleEntity rule, String serviceName) {
        Instant end = Instant.now();
        Instant start = end.minus(parseWindowSeconds(rule.getEvaluationWindow()), ChronoUnit.SECONDS);

        String condition = rule.getLogCondition();
        log.debug("Evaluating ES log condition for rule '{}': {} (window: {} → {})",
                rule.getName(), condition, start, end);

        return switch (condition) {
            case "error_count" -> {
                long errorCount = elasticsearchLogClient.countLogsWithSeverity(serviceName,
                        List.of("ERROR", "FATAL"), start, end);
                yield (double) errorCount;
            }
            case "error_ratio" -> {
                long total = elasticsearchLogClient.countTotalLogs(serviceName, start, end);
                if (total == 0) yield 0.0;
                long errors = elasticsearchLogClient.countLogsWithSeverity(serviceName,
                        List.of("ERROR", "FATAL"), start, end);
                yield (double) errors / total;
            }
            case "total_log_volume" -> {
                long total = elasticsearchLogClient.countTotalLogs(serviceName, start, end);
                yield (double) total;
            }
            default -> {
                // Treat as severity filter (e.g. "WARN", "ERROR")
                long count = elasticsearchLogClient.countLogsWithSeverity(serviceName,
                        List.of(condition), start, end);
                yield (double) count;
            }
        };
    }

    /**
     * Parse an evaluation window string like "5m", "1h", "30s" into seconds.
     */
    private long parseWindowSeconds(String window) {
        if (window == null || window.isEmpty()) return 300; // default 5m
        try {
            char unit = window.charAt(window.length() - 1);
            long value = Long.parseLong(window.substring(0, window.length() - 1));
            return switch (unit) {
                case 's' -> value;
                case 'm' -> value * 60;
                case 'h' -> value * 3600;
                case 'd' -> value * 86400;
                default -> 300;
            };
        } catch (NumberFormatException e) {
            return 300;
        }
    }

    // ── Threshold comparison ────────────────────────────────────────────────────

    private boolean isThresholdBreached(double value, String operator, double threshold) {
        return switch (operator) {
            case "GT"  -> value > threshold;
            case "GTE" -> value >= threshold;
            case "LT"  -> value < threshold;
            case "LTE" -> value <= threshold;
            case "EQ"  -> value == threshold;
            case "NEQ" -> value != threshold;
            default -> false;
        };
    }

    // ── Alert state machine ─────────────────────────────────────────────────────

    /**
     * Process the alert state transition based on evaluation result.
     * State machine: OK → PENDING → FIRING → RESOLVED
     * De-duplication: only one non-RESOLVED alert exists per SLA rule at a time.
     *
     * @return the AlertEntity if it transitioned to FIRING in this cycle, or null
     */
    private AlertEntity processAlertState(SlaRuleEntity rule, double evaluatedValue, boolean breached) {
        // De-duplication: find existing active alert for this rule (not RESOLVED)
        Optional<AlertEntity> existingOpt = alertRepository.findBySlaRuleIdAndStateNot(rule.getId(), "RESOLVED");

        if (breached) {
            if (existingOpt.isPresent()) {
                AlertEntity alert = existingOpt.get();
                alert.setEvaluatedValue(evaluatedValue);

                if ("OK".equals(alert.getState()) || "PENDING".equals(alert.getState())) {
                    int newCount = alert.getPendingCount() + 1;
                    alert.setPendingCount(newCount);

                    if (newCount >= rule.getPendingPeriods()) {
                        // Transition to FIRING
                        alert.setState("FIRING");
                        alert.setFiredAt(Instant.now());
                        alert.setMessage(buildAlertMessage(rule, evaluatedValue));
                        alertRepository.save(alert);
                        log.warn("ALERT FIRING: rule='{}', service={}, value={}, threshold={}",
                                rule.getName(), rule.getServiceId(), evaluatedValue, rule.getThreshold());
                        return alert;
                    } else {
                        alert.setState("PENDING");
                        alertRepository.save(alert);
                    }
                } else {
                    // Already FIRING — update evaluated value only (de-dup: no re-notification)
                    alertRepository.save(alert);
                }
            } else {
                // Create new alert
                AlertEntity newAlert = AlertEntity.builder()
                        .slaRuleId(rule.getId())
                        .serviceId(rule.getServiceId())
                        .state("PENDING")
                        .severity(rule.getSeverity())
                        .evaluatedValue(evaluatedValue)
                        .pendingCount(1)
                        .message(buildAlertMessage(rule, evaluatedValue))
                        .build();

                if (rule.getPendingPeriods() <= 1) {
                    // Immediate FIRING if pendingPeriods is 1
                    newAlert.setState("FIRING");
                    newAlert.setFiredAt(Instant.now());
                    alertRepository.save(newAlert);
                    log.warn("ALERT FIRING: rule='{}', service={}, value={}, threshold={}",
                            rule.getName(), rule.getServiceId(), evaluatedValue, rule.getThreshold());
                    return newAlert;
                } else {
                    alertRepository.save(newAlert);
                }
            }
        } else {
            // No breach — resolve any existing alert
            if (existingOpt.isPresent()) {
                AlertEntity alert = existingOpt.get();
                if (!"RESOLVED".equals(alert.getState())) {
                    alert.setState("RESOLVED");
                    alert.setResolvedAt(Instant.now());
                    alert.setEvaluatedValue(evaluatedValue);
                    alertRepository.save(alert);
                    log.info("ALERT RESOLVED: rule='{}', service={}", rule.getName(), rule.getServiceId());
                }
            }
        }
        return null;
    }

    /**
     * Story 11.2 — Apply suppression, group alerts, then dispatch notifications.
     */
    private void dispatchWithGroupingAndSuppression(List<AlertGroupingService.AlertRulePair> newlyFired) {
        // 1. Suppression: filter out alerts that were notified recently
        List<AlertGroupingService.AlertRulePair> unsuppressed =
                alertGroupingService.applySuppression(newlyFired);

        if (unsuppressed.isEmpty()) {
            log.debug("All {} newly-fired alerts suppressed by notification window", newlyFired.size());
            return;
        }

        // 2. Group by configured group key
        List<AlertGroupingService.AlertGroup> groups = alertGroupingService.groupAlerts(unsuppressed);

        log.info("Dispatching {} alert group(s) ({} alerts total after suppression)",
                groups.size(), unsuppressed.size());

        // 3. Dispatch each group
        for (AlertGroupingService.AlertGroup group : groups) {
            try {
                notificationService.dispatchGroupedNotifications(group);
            } catch (Exception e) {
                log.error("Failed to dispatch grouped notification for group '{}': {}",
                        group.groupKey(), e.getMessage());
            }
        }

        // 4. Mark all dispatched alerts as notified and persist
        alertGroupingService.markNotified(unsuppressed);
        for (AlertGroupingService.AlertRulePair pair : unsuppressed) {
            alertRepository.save(pair.alert());
        }
    }

    private String buildAlertMessage(SlaRuleEntity rule, double evaluatedValue) {
        return String.format("SLA breach: %s — %s %s %.4f (current: %.4f, window: %s)",
                rule.getName(), rule.getMetricName() != null ? rule.getMetricName() : rule.getLogCondition(),
                rule.getOperator(), rule.getThreshold(), evaluatedValue, rule.getEvaluationWindow());
    }
}

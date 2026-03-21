package com.observability.apm.service;

import com.observability.apm.entity.AlertEntity;
import com.observability.apm.entity.SlaRuleEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Story 11.2 — Alert grouping and notification suppression.
 * <p>Groups alerts by configurable labels and suppresses duplicate notifications
 * within a configured time window to prevent notification storms.
 *
 * <h3>Group keys:</h3>
 * <ul>
 *   <li>"service"            — group by serviceId (default)</li>
 *   <li>"service+severity"   — group by serviceId + severity</li>
 *   <li>"service+signal"     — group by serviceId + signalType</li>
 *   <li>"none"               — no grouping (each alert notified individually)</li>
 * </ul>
 *
 * <h3>Suppression:</h3>
 * Once a notification is sent for an alert, subsequent notifications are suppressed
 * for the duration of the rule's {@code suppressionWindow}.
 */
@Slf4j
@Service
public class AlertGroupingService {

    /**
     * A pending notification pairing an alert with its rule.
     */
    public record AlertRulePair(AlertEntity alert, SlaRuleEntity rule) {}

    /**
     * A grouped notification batch — keyed by a group label, containing all alerts
     * that belong to this group and should be dispatched together.
     */
    public record AlertGroup(String groupKey, List<AlertRulePair> alerts) {}

    /**
     * Filter out alerts that are within their suppression window
     * (i.e., a notification was already sent recently for this alert).
     *
     * @param pairs list of alert+rule pairs that want to send notifications
     * @return filtered list with suppressed alerts removed
     */
    public List<AlertRulePair> applySuppression(List<AlertRulePair> pairs) {
        Instant now = Instant.now();
        List<AlertRulePair> result = new ArrayList<>();

        for (AlertRulePair pair : pairs) {
            AlertEntity alert = pair.alert();
            SlaRuleEntity rule = pair.rule();

            if (alert.getLastNotifiedAt() == null) {
                // Never notified — allow
                result.add(pair);
                continue;
            }

            long windowSeconds = parseWindowSeconds(rule.getSuppressionWindow());
            Instant suppressionEnd = alert.getLastNotifiedAt().plus(windowSeconds, ChronoUnit.SECONDS);

            if (now.isAfter(suppressionEnd)) {
                // Suppression window has expired — allow
                result.add(pair);
            } else {
                log.debug("Suppressing notification for alert {} (rule='{}') — last notified at {}, window={}",
                        alert.getId(), rule.getName(), alert.getLastNotifiedAt(), rule.getSuppressionWindow());
            }
        }

        return result;
    }

    /**
     * Group alerts by the rule's configured group key.
     *
     * @param pairs list of alert+rule pairs to group
     * @return list of alert groups, each containing alerts with the same group label
     */
    public List<AlertGroup> groupAlerts(List<AlertRulePair> pairs) {
        Map<String, List<AlertRulePair>> grouped = new LinkedHashMap<>();

        for (AlertRulePair pair : pairs) {
            String key = resolveGroupKey(pair.alert(), pair.rule());
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(pair);
        }

        return grouped.entrySet().stream()
                .map(e -> new AlertGroup(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    /**
     * Mark alerts as notified: set lastNotifiedAt and increment notificationCount.
     */
    public void markNotified(List<AlertRulePair> pairs) {
        Instant now = Instant.now();
        for (AlertRulePair pair : pairs) {
            AlertEntity alert = pair.alert();
            alert.setLastNotifiedAt(now);
            alert.setNotificationCount(alert.getNotificationCount() + 1);
        }
    }

    // ── Internals ───────────────────────────────────────────────────────────────

    private String resolveGroupKey(AlertEntity alert, SlaRuleEntity rule) {
        String groupKeyConfig = rule.getGroupKey();
        if (groupKeyConfig == null) groupKeyConfig = "service";

        return switch (groupKeyConfig) {
            case "service+severity" -> alert.getServiceId() + "|" + alert.getSeverity();
            case "service+signal"   -> alert.getServiceId() + "|" + rule.getSignalType();
            case "none"             -> alert.getId().toString(); // unique per alert
            default                 -> alert.getServiceId().toString(); // "service" or any unknown
        };
    }

    private long parseWindowSeconds(String window) {
        if (window == null || window.isEmpty()) return 900; // default 15m
        try {
            char unit = window.charAt(window.length() - 1);
            long value = Long.parseLong(window.substring(0, window.length() - 1));
            return switch (unit) {
                case 's' -> value;
                case 'm' -> value * 60;
                case 'h' -> value * 3600;
                case 'd' -> value * 86400;
                default -> 900;
            };
        } catch (NumberFormatException e) {
            return 900;
        }
    }
}

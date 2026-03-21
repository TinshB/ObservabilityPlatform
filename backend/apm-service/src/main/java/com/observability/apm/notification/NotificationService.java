package com.observability.apm.notification;

import com.observability.apm.entity.AlertChannelEntity;
import com.observability.apm.entity.AlertEntity;
import com.observability.apm.entity.SlaRuleEntity;
import com.observability.apm.service.AlertGroupingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Story 10.5 — Notification router.
 * Routes alert notifications to the correct dispatcher based on channel type.
 */
@Slf4j
@Service
public class NotificationService {

    private final Map<String, NotificationDispatcher> dispatchers;

    /**
     * Spring auto-injects all NotificationDispatcher beans.
     * We index them by channel type for O(1) lookup.
     */
    public NotificationService(List<NotificationDispatcher> dispatcherList) {
        this.dispatchers = dispatcherList.stream()
                .collect(Collectors.toMap(NotificationDispatcher::getChannelType, Function.identity()));
        log.info("Notification router initialized with {} dispatchers: {}",
                dispatchers.size(), dispatchers.keySet());
    }

    /**
     * Dispatch alert notifications to all channels attached to the SLA rule.
     * Silently skips channels whose type has no registered dispatcher.
     */
    public void dispatchNotifications(AlertEntity alert, SlaRuleEntity rule) {
        Set<AlertChannelEntity> channels = rule.getChannels();
        if (channels == null || channels.isEmpty()) {
            log.debug("No channels configured for SLA rule '{}' — skipping notification", rule.getName());
            return;
        }

        for (AlertChannelEntity channel : channels) {
            dispatchToChannel(alert, rule, channel);
        }
    }

    /**
     * Story 11.2 — Dispatch a grouped (digest) notification for multiple alerts.
     * All alerts in the group are combined into a single notification per channel.
     * Uses the first alert's rule for channel selection (all alerts share channels within a group).
     */
    public void dispatchGroupedNotifications(AlertGroupingService.AlertGroup group) {
        if (group.alerts().isEmpty()) return;

        // Collect all unique channels from all rules in the group
        Set<AlertChannelEntity> allChannels = new LinkedHashSet<>();
        for (AlertGroupingService.AlertRulePair pair : group.alerts()) {
            Set<AlertChannelEntity> channels = pair.rule().getChannels();
            if (channels != null) {
                allChannels.addAll(channels);
            }
        }

        if (allChannels.isEmpty()) {
            log.debug("No channels for alert group '{}' — skipping", group.groupKey());
            return;
        }

        // If single alert in group, dispatch normally
        if (group.alerts().size() == 1) {
            AlertGroupingService.AlertRulePair pair = group.alerts().getFirst();
            dispatchNotifications(pair.alert(), pair.rule());
            return;
        }

        // Multiple alerts — dispatch the first as primary, with a digest summary
        AlertGroupingService.AlertRulePair primary = group.alerts().getFirst();
        AlertEntity digestAlert = buildDigestAlert(primary.alert(), group);

        for (AlertChannelEntity channel : allChannels) {
            dispatchToChannel(digestAlert, primary.rule(), channel);
        }

        log.info("Grouped notification dispatched for group '{}' with {} alerts",
                group.groupKey(), group.alerts().size());
    }

    // ── Internals ───────────────────────────────────────────────────────────────

    private void dispatchToChannel(AlertEntity alert, SlaRuleEntity rule, AlertChannelEntity channel) {
        if (!channel.isEnabled()) {
            log.debug("Skipping disabled channel '{}'", channel.getName());
            return;
        }

        NotificationDispatcher dispatcher = dispatchers.get(channel.getChannelType());
        if (dispatcher == null) {
            log.warn("No dispatcher registered for channel type '{}' (channel '{}')",
                    channel.getChannelType(), channel.getName());
            return;
        }

        try {
            dispatcher.dispatch(alert, rule, channel);
        } catch (Exception e) {
            log.error("Notification dispatch failed for channel '{}' (type={}): {}",
                    channel.getName(), channel.getChannelType(), e.getMessage());
        }
    }

    /**
     * Build a synthetic alert entity that contains a digest summary of all alerts in a group.
     */
    private AlertEntity buildDigestAlert(AlertEntity primary, AlertGroupingService.AlertGroup group) {
        StringBuilder digest = new StringBuilder();
        digest.append(String.format("[Grouped: %d alerts]\n", group.alerts().size()));
        for (AlertGroupingService.AlertRulePair pair : group.alerts()) {
            digest.append(String.format("  - %s: %s\n",
                    pair.rule().getName(),
                    pair.alert().getMessage() != null ? pair.alert().getMessage() : "N/A"));
        }

        return AlertEntity.builder()
                .id(primary.getId())
                .slaRuleId(primary.getSlaRuleId())
                .serviceId(primary.getServiceId())
                .state(primary.getState())
                .severity(primary.getSeverity())
                .message(digest.toString())
                .evaluatedValue(primary.getEvaluatedValue())
                .firedAt(primary.getFiredAt())
                .createdAt(primary.getCreatedAt())
                .updatedAt(primary.getUpdatedAt())
                .build();
    }
}

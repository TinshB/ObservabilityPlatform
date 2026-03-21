package com.observability.apm.notification;

import com.observability.apm.entity.AlertChannelEntity;
import com.observability.apm.entity.AlertEntity;
import com.observability.apm.entity.SlaRuleEntity;

/**
 * Story 10.5 — Notification dispatcher interface.
 * Each channel type (EMAIL, SMS, MS_TEAMS) implements this to send alerts.
 */
public interface NotificationDispatcher {

    /** The channel type this dispatcher handles. */
    String getChannelType();

    /**
     * Send an alert notification through this channel.
     *
     * @param alert   the alert that fired
     * @param rule    the SLA rule that was breached
     * @param channel the channel configuration
     */
    void dispatch(AlertEntity alert, SlaRuleEntity rule, AlertChannelEntity channel);
}

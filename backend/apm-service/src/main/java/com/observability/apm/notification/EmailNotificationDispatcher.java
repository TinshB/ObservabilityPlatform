package com.observability.apm.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.apm.entity.AlertChannelEntity;
import com.observability.apm.entity.AlertEntity;
import com.observability.apm.entity.SlaRuleEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Story 10.5 — Email notification dispatcher.
 * Sends alert notifications via SMTP using Spring Mail.
 *
 * Channel config JSON format:
 * { "recipients": ["ops@example.com"], "from": "alerts@observability.io" }
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmailNotificationDispatcher implements NotificationDispatcher {

    private final JavaMailSender mailSender;
    private final ObjectMapper objectMapper;

    @Override
    public String getChannelType() {
        return "EMAIL";
    }

    @Override
    public void dispatch(AlertEntity alert, SlaRuleEntity rule, AlertChannelEntity channel) {
        try {
            JsonNode config = objectMapper.readTree(channel.getConfig());

            String from = config.has("from") ? config.get("from").asText() : "alerts@observability.io";
            JsonNode recipientsNode = config.get("recipients");
            if (recipientsNode == null || !recipientsNode.isArray() || recipientsNode.isEmpty()) {
                log.warn("Email channel '{}' has no recipients configured", channel.getName());
                return;
            }

            String[] recipients = new String[recipientsNode.size()];
            for (int i = 0; i < recipientsNode.size(); i++) {
                recipients[i] = recipientsNode.get(i).asText();
            }

            String subject = String.format("[%s] Alert: %s", alert.getSeverity(), rule.getName());
            String body = String.format(
                    "Alert Notification\n\n" +
                    "Rule: %s\n" +
                    "Severity: %s\n" +
                    "State: %s\n" +
                    "Message: %s\n" +
                    "Evaluated Value: %s\n" +
                    "Threshold: %s %s\n" +
                    "Fired At: %s\n",
                    rule.getName(),
                    alert.getSeverity(),
                    alert.getState(),
                    alert.getMessage(),
                    alert.getEvaluatedValue(),
                    rule.getOperator(), rule.getThreshold(),
                    alert.getFiredAt());

            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(recipients);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);

            log.info("Email notification sent for alert {} via channel '{}' to {} recipients",
                    alert.getId(), channel.getName(), recipients.length);

        } catch (Exception e) {
            log.error("Failed to send email notification for alert {} via channel '{}': {}",
                    alert.getId(), channel.getName(), e.getMessage());
        }
    }
}

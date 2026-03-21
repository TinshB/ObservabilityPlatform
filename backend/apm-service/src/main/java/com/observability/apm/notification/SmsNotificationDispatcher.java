package com.observability.apm.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.apm.entity.AlertChannelEntity;
import com.observability.apm.entity.AlertEntity;
import com.observability.apm.entity.SlaRuleEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Story 10.5 — SMS notification dispatcher.
 * Stub implementation — logs the SMS payload for now.
 * In production, integrate with Twilio / AWS SNS.
 *
 * Channel config JSON format:
 * { "phoneNumbers": ["+1234567890"] }
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SmsNotificationDispatcher implements NotificationDispatcher {

    private final ObjectMapper objectMapper;

    @Override
    public String getChannelType() {
        return "SMS";
    }

    @Override
    public void dispatch(AlertEntity alert, SlaRuleEntity rule, AlertChannelEntity channel) {
        try {
            JsonNode config = objectMapper.readTree(channel.getConfig());
            JsonNode phoneNumbers = config.get("phoneNumbers");

            if (phoneNumbers == null || !phoneNumbers.isArray() || phoneNumbers.isEmpty()) {
                log.warn("SMS channel '{}' has no phone numbers configured", channel.getName());
                return;
            }

            String smsBody = String.format("[%s] %s — %s (value: %.4f, threshold: %s %s)",
                    alert.getSeverity(), rule.getName(), alert.getMessage(),
                    alert.getEvaluatedValue(), rule.getOperator(), rule.getThreshold());

            for (JsonNode phone : phoneNumbers) {
                log.info("SMS notification dispatched for alert {} to {} via channel '{}': {}",
                        alert.getId(), phone.asText(), channel.getName(), smsBody);
                // TODO: Integrate with Twilio / AWS SNS
                // twilioClient.send(phone.asText(), smsBody);
            }

        } catch (Exception e) {
            log.error("Failed to send SMS notification for alert {} via channel '{}': {}",
                    alert.getId(), channel.getName(), e.getMessage());
        }
    }
}

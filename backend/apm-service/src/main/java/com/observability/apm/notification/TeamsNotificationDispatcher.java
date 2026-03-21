package com.observability.apm.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.apm.entity.AlertChannelEntity;
import com.observability.apm.entity.AlertEntity;
import com.observability.apm.entity.SlaRuleEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Story 10.5 — MS Teams notification dispatcher.
 * Posts alert cards to a Teams incoming webhook URL.
 *
 * Channel config JSON format:
 * { "webhookUrl": "https://outlook.office.com/webhook/..." }
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TeamsNotificationDispatcher implements NotificationDispatcher {

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Override
    public String getChannelType() {
        return "MS_TEAMS";
    }

    @Override
    public void dispatch(AlertEntity alert, SlaRuleEntity rule, AlertChannelEntity channel) {
        try {
            JsonNode config = objectMapper.readTree(channel.getConfig());
            String webhookUrl = config.has("webhookUrl") ? config.get("webhookUrl").asText() : null;

            if (webhookUrl == null || webhookUrl.isBlank()) {
                log.warn("Teams channel '{}' has no webhookUrl configured", channel.getName());
                return;
            }

            // Build MessageCard payload for Teams
            Map<String, Object> card = Map.of(
                    "@type", "MessageCard",
                    "@context", "http://schema.org/extensions",
                    "themeColor", severityColor(alert.getSeverity()),
                    "summary", String.format("[%s] %s", alert.getSeverity(), rule.getName()),
                    "sections", new Object[]{
                            Map.of(
                                    "activityTitle", String.format("Alert: %s", rule.getName()),
                                    "facts", new Object[]{
                                            Map.of("name", "Severity", "value", alert.getSeverity()),
                                            Map.of("name", "State", "value", alert.getState()),
                                            Map.of("name", "Message", "value",
                                                    alert.getMessage() != null ? alert.getMessage() : "N/A"),
                                            Map.of("name", "Evaluated Value", "value",
                                                    alert.getEvaluatedValue() != null
                                                            ? String.format("%.4f", alert.getEvaluatedValue()) : "N/A"),
                                            Map.of("name", "Threshold", "value",
                                                    String.format("%s %.4f", rule.getOperator(), rule.getThreshold())),
                                            Map.of("name", "Fired At", "value",
                                                    alert.getFiredAt() != null ? alert.getFiredAt().toString() : "N/A")
                                    },
                                    "markdown", true
                            )
                    }
            );

            String payload = objectMapper.writeValueAsString(card);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> request = new HttpEntity<>(payload, headers);

            restTemplate.postForEntity(webhookUrl, request, String.class);

            log.info("Teams notification sent for alert {} via channel '{}'",
                    alert.getId(), channel.getName());

        } catch (Exception e) {
            log.error("Failed to send Teams notification for alert {} via channel '{}': {}",
                    alert.getId(), channel.getName(), e.getMessage());
        }
    }

    private String severityColor(String severity) {
        return switch (severity) {
            case "CRITICAL" -> "FF0000";
            case "WARNING" -> "FFA500";
            default -> "0078D7";
        };
    }
}

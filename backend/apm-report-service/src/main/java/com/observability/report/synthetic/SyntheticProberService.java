package com.observability.report.synthetic;

import com.observability.report.entity.SyntheticCheckEntity;
import com.observability.report.entity.SyntheticResultEntity;
import com.observability.report.repository.SyntheticResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Story 14.6 — Synthetic Prober for web application monitoring.
 * Executes HTTP probes against web pages and application endpoints,
 * validates status code, response body, and latency assertions.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyntheticProberService {

    private final SyntheticResultRepository resultRepository;

    @Async("reportGenerationExecutor")
    public void executeProbe(SyntheticCheckEntity check) {
        log.debug("Executing probe '{}' → {} {}", check.getName(), check.getHttpMethod(), check.getUrl());

        Instant start = Instant.now();
        SyntheticResultEntity.SyntheticResultEntityBuilder resultBuilder = SyntheticResultEntity.builder()
                .checkId(check.getId())
                .checkName(check.getName())
                .executedAt(start);

        HttpURLConnection conn = null;
        try {
            URL url = new URL(check.getUrl());
            conn = (HttpURLConnection) url.openConnection();

            conn.setRequestMethod(check.getHttpMethod().toUpperCase());
            conn.setConnectTimeout(Math.min(check.getTimeoutMs(), 30_000));
            conn.setReadTimeout(check.getTimeoutMs());
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "ObservabilityPlatform-SyntheticProber/1.0");
            conn.setRequestProperty("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8");

            // Apply custom headers
            if (check.getRequestHeaders() != null && !check.getRequestHeaders().isBlank()) {
                parseHeaders(check.getRequestHeaders()).forEach(conn::setRequestProperty);
            }

            // Send request body if present
            String body = check.getRequestBody();
            if (body != null && !body.isBlank()) {
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.getBytes(StandardCharsets.UTF_8));
                }
            }

            int statusCode = conn.getResponseCode();
            long latencyMs = Duration.between(start, Instant.now()).toMillis();

            // Read response body
            String responseBody;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    statusCode < 400 ? conn.getInputStream() : conn.getErrorStream(),
                    StandardCharsets.UTF_8))) {
                responseBody = reader.lines().collect(Collectors.joining("\n"));
            } catch (Exception e) {
                responseBody = null;
            }

            boolean statusCodeMatch = evaluateStatusCode(check, statusCode);
            boolean bodyMatch = evaluateBody(check, responseBody);
            boolean latencyMatch = evaluateLatency(check, latencyMs);
            boolean overallSuccess = statusCodeMatch && bodyMatch && latencyMatch;

            String bodySnippet = responseBody != null
                    ? responseBody.substring(0, Math.min(responseBody.length(), 500))
                    : null;

            resultRepository.save(resultBuilder
                    .statusCode(statusCode)
                    .latencyMs(latencyMs)
                    .success(overallSuccess)
                    .statusCodeMatch(statusCodeMatch)
                    .bodyMatch(bodyMatch)
                    .latencyMatch(latencyMatch)
                    .responseBodySnippet(bodySnippet)
                    .build());

            log.info("Probe '{}' completed: status={}, latency={}ms, success={}",
                    check.getName(), statusCode, latencyMs, overallSuccess);

        } catch (Exception e) {
            long latencyMs = Duration.between(start, Instant.now()).toMillis();
            String errorMsg = formatError(e);

            resultRepository.save(resultBuilder
                    .latencyMs(latencyMs)
                    .success(false)
                    .statusCodeMatch(false)
                    .bodyMatch(false)
                    .latencyMatch(false)
                    .errorMessage(errorMsg)
                    .build());

            log.warn("Probe '{}' → {} failed ({}ms): {}", check.getName(), check.getUrl(), latencyMs, errorMsg);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private boolean evaluateStatusCode(SyntheticCheckEntity check, int actual) {
        if (check.getExpectedStatusCode() == null) {
            return actual >= 200 && actual < 400;
        }
        return actual == check.getExpectedStatusCode();
    }

    private boolean evaluateBody(SyntheticCheckEntity check, String body) {
        if (check.getExpectedBodyContains() == null || check.getExpectedBodyContains().isBlank()) {
            return true;
        }
        return body != null && body.contains(check.getExpectedBodyContains());
    }

    private boolean evaluateLatency(SyntheticCheckEntity check, long latencyMs) {
        if (check.getMaxLatencyMs() == null) {
            return true;
        }
        return latencyMs <= check.getMaxLatencyMs();
    }

    private Map<String, String> parseHeaders(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, new com.fasterxml.jackson.core.type.TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Failed to parse request headers: {}", e.getMessage());
            return Map.of();
        }
    }

    private String formatError(Exception e) {
        Throwable cause = e.getCause() != null ? e.getCause() : e;
        String msg = cause.getMessage();
        if (msg == null) return cause.getClass().getSimpleName();

        if (msg.contains("Connection refused")) {
            return "Connection refused — target application is not reachable";
        }
        if (msg.contains("timed out") || msg.contains("Timeout")) {
            return "Connection timed out — target did not respond within timeout";
        }
        if (msg.contains("UnknownHost") || msg.contains("No such host")) {
            return "DNS resolution failed — hostname could not be resolved";
        }

        return msg.length() > 2000 ? msg.substring(0, 2000) : msg;
    }
}

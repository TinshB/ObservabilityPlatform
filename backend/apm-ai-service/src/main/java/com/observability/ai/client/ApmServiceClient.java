package com.observability.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.*;

/**
 * REST client for communicating with apm-service.
 * Bridges AI service to the core observability platform for
 * services, traces, dependencies, and workflows.
 */
@Slf4j
@Component
public class ApmServiceClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /** Holds JWT token for async threads where RequestContext is unavailable. */
    private static final ThreadLocal<String> AUTH_TOKEN = new ThreadLocal<>();

    public ApmServiceClient(@Qualifier("apmServiceRestTemplate") RestTemplate restTemplate,
                            ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    /** Set the auth token for the current thread (call before async work). */
    public void setAuthToken(String token) {
        AUTH_TOKEN.set(token);
    }

    /** Clear the auth token (call in finally block after async work). */
    public void clearAuthToken() {
        AUTH_TOKEN.remove();
    }

    // ── Services ─────────────────────────────────────────────────────────────

    /**
     * Fetch all registered services from the Service Catalog.
     */
    public JsonNode getServices(String search, int page, int size) {
        String url = UriComponentsBuilder.fromPath("/api/v1/services")
                .queryParam("page", page)
                .queryParam("size", size)
                .queryParamIfPresent("search", Optional.ofNullable(search))
                .toUriString();
        return doGet(url);
    }

    /**
     * Fetch a single service by ID.
     */
    public JsonNode getServiceById(UUID serviceId) {
        return doGet("/api/v1/services/detail/" + serviceId);
    }

    // ── Traces ───────────────────────────────────────────────────────────────

    /**
     * Fetch traces for a service within a time range.
     * The apm-service TraceController expects ISO-8601 Instant strings for start/end
     * and caps limit at 100.
     */
    public JsonNode getTraces(UUID serviceId, String operation, Instant start, Instant end,
                              int limit, String tags) {
        var builder = UriComponentsBuilder.fromPath("/api/v1/services/" + serviceId + "/traces")
                .queryParam("start", start.toString())
                .queryParam("end", end.toString())
                .queryParam("limit", Math.min(limit, 100));
        if (operation != null && !operation.isBlank()) builder.queryParam("operation", operation);
        if (tags != null && !tags.isBlank()) builder.queryParam("tags", tags);
        return doGet(builder.toUriString());
    }

    /**
     * Fetch a single trace by trace ID (full span tree).
     */
    public JsonNode getTraceDetail(String traceId) {
        return doGet("/api/v1/traces/" + traceId);
    }

    /**
     * Fetch available operations for a service.
     */
    public JsonNode getOperations(UUID serviceId) {
        return doGet("/api/v1/services/" + serviceId + "/traces/operations");
    }

    // ── Dependencies ─────────────────────────────────────────────────────────

    /**
     * Fetch the dependency graph for a service.
     */
    public JsonNode getDependencyGraph(UUID serviceId) {
        return doGet("/api/v1/services/" + serviceId + "/dependencies/graph");
    }

    // ── Workflows ────────────────────────────────────────────────────────────

    /**
     * List all workflows.
     */
    public JsonNode listWorkflows() {
        return doGet("/api/v1/workflows");
    }

    /**
     * Get workflow by ID.
     */
    public JsonNode getWorkflow(UUID workflowId) {
        return doGet("/api/v1/workflows/" + workflowId);
    }

    /**
     * Create a new workflow.
     */
    public JsonNode createWorkflow(Map<String, Object> workflowPayload) {
        return doPost("/api/v1/workflows", workflowPayload);
    }

    /**
     * Add a step to a workflow.
     */
    public JsonNode addWorkflowStep(UUID workflowId, Map<String, Object> stepPayload) {
        return doPost("/api/v1/workflows/" + workflowId + "/steps", stepPayload);
    }

    /**
     * Get workflow steps.
     */
    public JsonNode getWorkflowSteps(UUID workflowId) {
        return doGet("/api/v1/workflows/" + workflowId + "/steps");
    }

    // ── HTTP helpers ─────────────────────────────────────────────────────────

    private JsonNode doGet(String url) {
        try {
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    url, HttpMethod.GET, httpEntity(), new ParameterizedTypeReference<>() {});
            return extractData(response.getBody());
        } catch (Exception e) {
            log.error("GET {} failed: {}", url, e.getMessage());
            throw new RuntimeException("APM service call failed: " + url, e);
        }
    }

    private JsonNode doPost(String url, Object body) {
        try {
            HttpEntity<Object> entity = new HttpEntity<>(body, jsonHeaders());
            ResponseEntity<JsonNode> response = restTemplate.exchange(
                    url, HttpMethod.POST, entity, new ParameterizedTypeReference<>() {});
            return extractData(response.getBody());
        } catch (Exception e) {
            log.error("POST {} failed: {}", url, e.getMessage());
            throw new RuntimeException("APM service call failed: " + url, e);
        }
    }

    private JsonNode extractData(JsonNode responseBody) {
        if (responseBody == null) return objectMapper.nullNode();
        // ApiResponse wraps data in a "data" field
        if (responseBody.has("data")) {
            return responseBody.get("data");
        }
        return responseBody;
    }

    private HttpEntity<Void> httpEntity() {
        return new HttpEntity<>(jsonHeaders());
    }

    private HttpHeaders jsonHeaders() {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        // Forward JWT token for inter-service auth
        String token = resolveAuthToken();
        if (token != null) {
            headers.set("Authorization", token);
        }
        return headers;
    }

    /**
     * Resolve JWT token: first try ThreadLocal (for async threads),
     * then fall back to the current HTTP request context.
     */
    private String resolveAuthToken() {
        // 1. ThreadLocal (set explicitly for async execution)
        String token = AUTH_TOKEN.get();
        if (token != null) return token;

        // 2. Current request context (works for synchronous calls)
        try {
            var attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes servletAttrs) {
                HttpServletRequest request = servletAttrs.getRequest();
                return request.getHeader("Authorization");
            }
        } catch (Exception e) {
            log.debug("Could not extract JWT from request context: {}", e.getMessage());
        }
        return null;
    }
}

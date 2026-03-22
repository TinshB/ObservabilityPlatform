package com.observability.billing.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.observability.billing.config.UserServiceProperties;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * US-BILL-010 — HTTP client for the user-management-service.
 * Fetches user data to calculate licence cost summaries.
 */
@Slf4j
@Component
public class UserServiceClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public UserServiceClient(UserServiceProperties props) {
        this.baseUrl = props.getUrl();

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(props.getConnectTimeout()));
        factory.setReadTimeout(Duration.ofMillis(props.getReadTimeout()));
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * Get user counts grouped by role from the user-management-service.
     * Fetches all users via paginated API and counts by role.
     *
     * @return map of role name → user count (e.g., {"ADMIN": 3, "OPERATOR": 8, "VIEWER": 15})
     */
    public Map<String, Long> getUserCountsByRole() {
        List<UserSummary> allUsers = fetchAllUsers();

        Map<String, Long> counts = new LinkedHashMap<>();
        for (UserSummary user : allUsers) {
            if (!user.isActive()) continue;
            if (user.getRoles() != null) {
                for (String role : user.getRoles()) {
                    counts.merge(role.toUpperCase(), 1L, Long::sum);
                }
            }
        }

        return counts;
    }

    /**
     * Get total active user count.
     */
    public long getTotalActiveUsers() {
        List<UserSummary> allUsers = fetchAllUsers();
        return allUsers.stream().filter(UserSummary::isActive).count();
    }

    /**
     * Get all users with their roles for CSV export.
     */
    public List<UserSummary> getAllUsers() {
        return fetchAllUsers();
    }

    private List<UserSummary> fetchAllUsers() {
        List<UserSummary> allUsers = new ArrayList<>();
        int page = 0;
        int size = 100;
        boolean hasMore = true;

        HttpHeaders headers = buildAuthHeaders();

        while (hasMore) {
            URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl)
                    .path("/api/v1/users")
                    .queryParam("page", page)
                    .queryParam("size", size)
                    .build().encode().toUri();

            try {
                HttpEntity<Void> entity = new HttpEntity<>(headers);
                ResponseEntity<JsonNode> response = restTemplate.exchange(
                        uri, HttpMethod.GET, entity, JsonNode.class);

                JsonNode body = response.getBody();
                if (body == null) break;

                JsonNode data = body.path("data");
                JsonNode content = data.path("content");

                if (!content.isArray() || content.isEmpty()) {
                    hasMore = false;
                    continue;
                }

                for (JsonNode userNode : content) {
                    UserSummary user = new UserSummary();
                    user.setId(userNode.path("id").asText());
                    user.setUsername(userNode.path("username").asText());
                    user.setEmail(userNode.path("email").asText());
                    user.setActive(userNode.path("active").asBoolean(true));

                    List<String> roles = new ArrayList<>();
                    JsonNode rolesNode = userNode.path("roles");
                    if (rolesNode.isArray()) {
                        for (JsonNode role : rolesNode) {
                            roles.add(role.asText());
                        }
                    }
                    user.setRoles(roles);
                    allUsers.add(user);
                }

                boolean isLast = data.path("last").asBoolean(true);
                hasMore = !isLast;
                page++;

            } catch (RestClientException ex) {
                log.error("Failed to fetch users from user-management-service (page={}): {}",
                        page, ex.getMessage());
                hasMore = false;
            }
        }

        return allUsers;
    }

    /**
     * Forward the current request's JWT token for inter-service auth.
     */
    private HttpHeaders buildAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() != null) {
            headers.setBearerAuth(auth.getCredentials().toString());
        }
        return headers;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UserSummary {
        private String id;
        private String username;
        private String email;
        private boolean active;
        private List<String> roles;
    }
}

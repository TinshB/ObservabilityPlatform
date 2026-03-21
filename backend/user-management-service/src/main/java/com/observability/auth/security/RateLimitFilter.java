package com.observability.auth.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.shared.dto.ErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory token-bucket rate limiter applied to all incoming HTTP requests.
 *
 * <p>Keyed on the authenticated user's username (from SecurityContext) or the
 * client's remote IP address for unauthenticated requests.
 *
 * <p>When the bucket is exhausted, a 429 Too Many Requests response is returned
 * with a {@code Retry-After} header indicating when the client can retry.
 *
 * <p>Stale buckets are cleaned up periodically to prevent memory leaks.
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final long CLEANUP_INTERVAL_MS = 60_000; // 1 minute

    private final RateLimitConfig rateLimitConfig;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final AtomicLong lastCleanup = new AtomicLong(System.currentTimeMillis());

    public RateLimitFilter(RateLimitConfig rateLimitConfig, ObjectMapper objectMapper) {
        this.rateLimitConfig = rateLimitConfig;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        cleanupStaleBuckets();

        String key = resolveClientKey(request);
        TokenBucket bucket = buckets.computeIfAbsent(key,
                k -> new TokenBucket(rateLimitConfig.getBurstCapacity(), rateLimitConfig.getRequestsPerSecond()));

        if (bucket.tryConsume()) {
            filterChain.doFilter(request, response);
        } else {
            log.warn("Rate limit exceeded for key '{}'", key);

            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setHeader("Retry-After", "1");

            ErrorResponse errorResponse = ErrorResponse.builder()
                    .errorCode("RATE_LIMIT_EXCEEDED")
                    .message("Too many requests. Please try again later.")
                    .path(request.getRequestURI())
                    .timestamp(Instant.now())
                    .build();

            objectMapper.writeValue(response.getOutputStream(), errorResponse);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/actuator/health");
    }

    private String resolveClientKey(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && !"anonymousUser".equals(authentication.getPrincipal())) {
            return "user:" + authentication.getName();
        }

        // Fall back to client IP
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            return "ip:" + forwardedFor.split(",")[0].trim();
        }
        return "ip:" + request.getRemoteAddr();
    }

    /**
     * Periodically remove token buckets that have not been accessed recently
     * to prevent unbounded memory growth.
     */
    private void cleanupStaleBuckets() {
        long now = System.currentTimeMillis();
        long last = lastCleanup.get();
        if (now - last > CLEANUP_INTERVAL_MS && lastCleanup.compareAndSet(last, now)) {
            long staleThreshold = now - (CLEANUP_INTERVAL_MS * 5); // 5 minutes of inactivity
            buckets.entrySet().removeIf(entry ->
                    entry.getValue().getLastAccessTime() < staleThreshold);
            log.debug("Rate limit bucket cleanup completed; active buckets: {}", buckets.size());
        }
    }

    /**
     * Token bucket implementation for rate limiting.
     * Thread-safe via synchronized access.
     */
    static class TokenBucket {
        private final int maxTokens;
        private final double refillRate; // tokens per millisecond
        private double tokens;
        private long lastRefillTime;
        private long lastAccessTime;

        TokenBucket(int maxTokens, int tokensPerSecond) {
            this.maxTokens = maxTokens;
            this.refillRate = tokensPerSecond / 1000.0;
            this.tokens = maxTokens;
            this.lastRefillTime = System.currentTimeMillis();
            this.lastAccessTime = System.currentTimeMillis();
        }

        synchronized boolean tryConsume() {
            refill();
            lastAccessTime = System.currentTimeMillis();
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }

        synchronized long getLastAccessTime() {
            return lastAccessTime;
        }

        private void refill() {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRefillTime;
            if (elapsed > 0) {
                tokens = Math.min(maxTokens, tokens + elapsed * refillRate);
                lastRefillTime = now;
            }
        }
    }
}

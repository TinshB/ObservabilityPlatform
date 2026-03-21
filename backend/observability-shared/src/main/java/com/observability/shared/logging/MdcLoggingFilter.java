package com.observability.shared.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Servlet filter that populates the MDC (Mapped Diagnostic Context) on every
 * inbound HTTP request and clears it on completion.
 *
 * <p>MDC keys written:
 * <ul>
 *   <li>{@code requestId} — unique per-request ID (generated if not provided)</li>
 *   <li>{@code traceId}   — distributed trace correlation ID (from header or generated)</li>
 *   <li>{@code spanId}    — span ID within the trace (from header or generated)</li>
 *   <li>{@code httpMethod} — HTTP verb</li>
 *   <li>{@code httpUri}   — request URI</li>
 * </ul>
 *
 * <p>The {@code traceId} is also echoed back to the caller via the
 * {@code X-Trace-Id} response header so distributed systems can correlate responses.
 *
 * <p>All MDC keys appear automatically in JSON log lines when using the
 * {@code logstash-logback-encoder} (production profile).
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class MdcLoggingFilter extends OncePerRequestFilter {

    public static final String HEADER_REQUEST_ID = "X-Request-Id";
    public static final String HEADER_TRACE_ID   = "X-Trace-Id";
    public static final String HEADER_SPAN_ID    = "X-Span-Id";

    public static final String MDC_REQUEST_ID  = "requestId";
    public static final String MDC_TRACE_ID    = "traceId";
    public static final String MDC_SPAN_ID     = "spanId";
    public static final String MDC_HTTP_METHOD = "httpMethod";
    public static final String MDC_HTTP_URI    = "httpUri";

    @Override
    protected void doFilterInternal(HttpServletRequest  request,
                                    HttpServletResponse response,
                                    FilterChain         filterChain) throws ServletException, IOException {
        try {
            populateMdc(request);
            response.setHeader(HEADER_TRACE_ID, MDC.get(MDC_TRACE_ID));
            filterChain.doFilter(request, response);
        } finally {
            MDC.clear(); // Always clear to prevent MDC leakage across thread-pool reuse
        }
    }

    private void populateMdc(HttpServletRequest request) {
        MDC.put(MDC_REQUEST_ID,  resolveOrGenerate(request.getHeader(HEADER_REQUEST_ID)));
        MDC.put(MDC_TRACE_ID,    resolveOrGenerate(request.getHeader(HEADER_TRACE_ID)));
        MDC.put(MDC_SPAN_ID,     resolveOrGenerate(request.getHeader(HEADER_SPAN_ID)));
        MDC.put(MDC_HTTP_METHOD, request.getMethod());
        MDC.put(MDC_HTTP_URI,    request.getRequestURI());
    }

    private String resolveOrGenerate(String headerValue) {
        return StringUtils.hasText(headerValue) ? headerValue : UUID.randomUUID().toString();
    }
}

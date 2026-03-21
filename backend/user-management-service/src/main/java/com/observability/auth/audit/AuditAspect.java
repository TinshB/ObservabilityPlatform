package com.observability.auth.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * AOP aspect that intercepts methods annotated with {@link Audited}
 * after successful execution and publishes an audit event to Elasticsearch
 * via {@link AuditService}.
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditAspect {

    private final AuditService auditService;

    @AfterReturning(pointcut = "@annotation(com.observability.auth.audit.Audited)", returning = "result")
    public void auditMethod(JoinPoint joinPoint, Object result) {
        try {
            MethodSignature signature = (MethodSignature) joinPoint.getSignature();
            Method method = signature.getMethod();
            Audited annotation = method.getAnnotation(Audited.class);

            String actor = resolveActor();
            String action = annotation.action();
            String resource = joinPoint.getTarget().getClass().getSimpleName();
            String resourceId = resolveResourceId(joinPoint);

            Map<String, Object> details = new HashMap<>();
            details.put("method", method.getName());
            details.put("class", resource);

            AuditEvent event = AuditEvent.builder()
                    .actor(actor)
                    .action(action)
                    .resource(resource)
                    .resourceId(resourceId)
                    .details(details)
                    .timestamp(Instant.now())
                    .build();

            auditService.logEvent(event);
        } catch (Exception ex) {
            log.warn("Failed to create audit event for method {}: {}",
                    joinPoint.getSignature().getName(), ex.getMessage());
        }
    }

    private String resolveActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            return authentication.getName();
        }
        return "anonymous";
    }

    private String resolveResourceId(JoinPoint joinPoint) {
        Object[] args = joinPoint.getArgs();
        if (args.length > 0 && args[0] != null) {
            return args[0].toString();
        }
        return "N/A";
    }
}

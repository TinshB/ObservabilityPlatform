package com.observability.auth.security;

import com.observability.shared.exception.ForbiddenException;
import com.observability.shared.exception.UnauthorizedException;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;

/**
 * AOP aspect that enforces fine-grained permission checks on methods
 * annotated with {@link RequiresPermission}.
 *
 * <p>Checks that the current authenticated user has an authority matching
 * the {@code resource:action} pattern defined in the annotation.
 */
@Slf4j
@Aspect
@Component
public class PermissionAspect {

    @Around("@annotation(com.observability.auth.security.RequiresPermission)")
    public Object checkPermission(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        RequiresPermission annotation = method.getAnnotation(RequiresPermission.class);

        String requiredPermission = annotation.resource() + ":" + annotation.action();

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new UnauthorizedException("Authentication required to access this resource");
        }

        boolean hasPermission = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> authority.equals(requiredPermission));

        if (!hasPermission) {
            log.warn("User '{}' denied access: missing permission '{}' on {}.{}()",
                    authentication.getName(),
                    requiredPermission,
                    joinPoint.getTarget().getClass().getSimpleName(),
                    method.getName());
            throw new ForbiddenException(
                    String.format("Access denied: permission '%s' required", requiredPermission));
        }

        log.debug("User '{}' authorized with permission '{}' for {}.{}()",
                authentication.getName(),
                requiredPermission,
                joinPoint.getTarget().getClass().getSimpleName(),
                method.getName());

        return joinPoint.proceed();
    }
}

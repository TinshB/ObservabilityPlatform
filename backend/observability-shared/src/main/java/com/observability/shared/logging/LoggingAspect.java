package com.observability.shared.logging;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;

/**
 * AOP aspect that instruments all {@code @Service}-annotated beans with
 * method-entry/exit trace logging and elapsed-time tracking.
 *
 * <p>Log level strategy:
 * <ul>
 *   <li>TRACE — method entry and normal exit (with elapsed time)</li>
 *   <li>DEBUG — exceptions thrown from service methods (with elapsed time)</li>
 * </ul>
 *
 * <p>This keeps INFO-level logs clean in production while still providing
 * full call traces when TRACE is enabled per-package for debugging.
 *
 * <p>The aspect does NOT log method arguments or return values by default
 * to prevent accidental exposure of PII or secrets in log output.
 */
@Slf4j
@Aspect
@Component
public class LoggingAspect {

    @Pointcut("within(@org.springframework.stereotype.Service *)")
    public void serviceLayer() {}

    @Around("serviceLayer()")
    public Object logServiceMethod(ProceedingJoinPoint joinPoint) throws Throwable {
        String className  = joinPoint.getSignature().getDeclaringType().getSimpleName();
        String methodName = joinPoint.getSignature().getName();

        log.trace(">> {}.{}()", className, methodName);
        long start = System.currentTimeMillis();

        try {
            Object result = joinPoint.proceed();
            log.trace("<< {}.{}() completed in {}ms", className, methodName, elapsed(start));
            return result;
        } catch (Exception ex) {
            log.debug("!! {}.{}() threw {} after {}ms: {}",
                    className, methodName,
                    ex.getClass().getSimpleName(), elapsed(start),
                    ex.getMessage());
            throw ex;
        }
    }

    private long elapsed(long start) {
        return System.currentTimeMillis() - start;
    }
}

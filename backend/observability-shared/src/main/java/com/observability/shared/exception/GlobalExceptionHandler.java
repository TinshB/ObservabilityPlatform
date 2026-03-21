package com.observability.shared.exception;

import com.observability.shared.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.List;

/**
 * Central exception handler for all REST controllers in every microservice.
 *
 * <p>Activated automatically via {@code SharedAutoConfiguration} (Spring Boot auto-config).
 * Each microservice does not need to declare its own {@code @ControllerAdvice}.
 *
 * <p>Handled exception → HTTP status mappings:
 * <ul>
 *   <li>{@link ObservabilityException} and subclasses → status from {@code ex.getHttpStatus()}</li>
 *   <li>{@link MethodArgumentNotValidException} → 400 (Bean Validation)</li>
 *   <li>{@link HttpMessageNotReadableException} → 400 (malformed request body)</li>
 *   <li>{@link MissingServletRequestParameterException} → 400 (missing query param)</li>
 *   <li>{@link MethodArgumentTypeMismatchException} → 400 (type mismatch in path/query)</li>
 *   <li>{@link Exception} (catch-all) → 500</li>
 * </ul>
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ObservabilityException.class)
    public ResponseEntity<ErrorResponse> handleObservabilityException(
            ObservabilityException ex, HttpServletRequest request) {
        log.warn("ObservabilityException [{}] at {}: {}", ex.getErrorCode(), request.getRequestURI(), ex.getMessage());
        return ResponseEntity
                .status(ex.getHttpStatus())
                .body(buildErrorResponse(ex.getErrorCode(), ex.getMessage(), request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        List<ErrorResponse.FieldValidationError> fieldErrors = ex.getBindingResult()
                .getAllErrors()
                .stream()
                .map(error -> {
                    if (error instanceof FieldError fe) {
                        return ErrorResponse.FieldValidationError.builder()
                                .field(fe.getField())
                                .rejectedValue(fe.getRejectedValue())
                                .message(fe.getDefaultMessage())
                                .build();
                    }
                    return ErrorResponse.FieldValidationError.builder()
                            .field(error.getObjectName())
                            .message(error.getDefaultMessage())
                            .build();
                })
                .toList();

        log.warn("Validation failed at {}: {} error(s)", request.getRequestURI(), fieldErrors.size());
        ErrorResponse body = buildErrorResponse("VALIDATION_ERROR", "Request validation failed", request);
        body.setValidationErrors(fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleMessageNotReadable(
            HttpMessageNotReadableException ex, HttpServletRequest request) {
        log.warn("Malformed request body at {}: {}", request.getRequestURI(), ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(buildErrorResponse("MALFORMED_REQUEST", "Request body is malformed or missing", request));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParam(
            MissingServletRequestParameterException ex, HttpServletRequest request) {
        String message = String.format("Required parameter '%s' is missing", ex.getParameterName());
        log.warn("Missing parameter at {}: {}", request.getRequestURI(), message);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(buildErrorResponse("MISSING_PARAMETER", message, request));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        String message = String.format("Parameter '%s' has invalid value: '%s'", ex.getName(), ex.getValue());
        log.warn("Type mismatch at {}: {}", request.getRequestURI(), message);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(buildErrorResponse("INVALID_PARAMETER", message, request));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(
            Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception at {}", request.getRequestURI(), ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(buildErrorResponse("INTERNAL_ERROR", "An unexpected error occurred", request));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ErrorResponse buildErrorResponse(String errorCode, String message, HttpServletRequest request) {
        return ErrorResponse.builder()
                .errorCode(errorCode)
                .message(message)
                .path(request.getRequestURI())
                .traceId(MDC.get("traceId"))
                .build();
    }
}

package com.observability.ai.grpc;

import com.observability.ai.config.GrpcClientConfig;
import com.observability.ai.proto.*;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * gRPC client that communicates with the Python ML sidecar process.
 * The sidecar runs alongside this Spring Boot service and handles
 * computationally intensive ML workloads (anomaly detection, forecasting, etc.).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MlSidecarClient {

    private final GrpcClientConfig config;
    private ManagedChannel channel;
    private MlServiceGrpc.MlServiceBlockingStub blockingStub;

    @PostConstruct
    public void init() {
        log.info("Connecting to Python ML sidecar at {}:{}", config.getHost(), config.getPort());
        channel = ManagedChannelBuilder.forAddress(config.getHost(), config.getPort())
                .maxInboundMessageSize(config.getMaxMessageSize())
                .usePlaintext()
                .build();
        blockingStub = MlServiceGrpc.newBlockingStub(channel);
    }

    @PreDestroy
    public void shutdown() {
        if (channel != null && !channel.isShutdown()) {
            try {
                channel.shutdown().awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                channel.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
    }

    public AnomalyDetectionResponse detectAnomalies(AnomalyDetectionRequest request) {
        try {
            return stub().detectAnomalies(request);
        } catch (StatusRuntimeException e) {
            log.error("gRPC anomaly detection failed: {} - {}", e.getStatus().getCode(), e.getMessage());
            throw new RuntimeException("ML sidecar anomaly detection failed: " + e.getStatus().getDescription(), e);
        }
    }

    public RootCauseResponse analyzeRootCause(RootCauseRequest request) {
        try {
            return stub().analyzeRootCause(request);
        } catch (StatusRuntimeException e) {
            log.error("gRPC root cause analysis failed: {} - {}", e.getStatus().getCode(), e.getMessage());
            throw new RuntimeException("ML sidecar root cause analysis failed: " + e.getStatus().getDescription(), e);
        }
    }

    public ForecastResponse forecast(ForecastRequest request) {
        try {
            return stub().forecast(request);
        } catch (StatusRuntimeException e) {
            log.error("gRPC forecasting failed: {} - {}", e.getStatus().getCode(), e.getMessage());
            throw new RuntimeException("ML sidecar forecasting failed: " + e.getStatus().getDescription(), e);
        }
    }

    public ErrorDiagnosisResponse diagnoseErrors(ErrorDiagnosisRequest request) {
        try {
            return stub().diagnoseErrors(request);
        } catch (StatusRuntimeException e) {
            log.error("gRPC error diagnosis failed: {} - {}", e.getStatus().getCode(), e.getMessage());
            throw new RuntimeException("ML sidecar error diagnosis failed: " + e.getStatus().getDescription(), e);
        }
    }

    public HealthCheckResponse checkHealth() {
        try {
            return stub().checkHealth(HealthCheckRequest.getDefaultInstance());
        } catch (StatusRuntimeException e) {
            log.warn("ML sidecar health check failed: {}", e.getStatus().getCode());
            return HealthCheckResponse.newBuilder()
                    .setStatus("NOT_SERVING")
                    .build();
        }
    }

    private MlServiceGrpc.MlServiceBlockingStub stub() {
        return blockingStub.withDeadlineAfter(config.getTimeoutMs(), TimeUnit.MILLISECONDS);
    }
}

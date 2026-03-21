package com.observability.ai.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "ai.grpc")
@Getter
@Setter
public class GrpcClientConfig {

    /** Host of the Python ML sidecar gRPC server. */
    private String host = "localhost";

    /** Port of the Python ML sidecar gRPC server. */
    private int port = 50051;

    /** Timeout in milliseconds for gRPC calls to the sidecar. */
    private long timeoutMs = 30000;

    /** Maximum message size in bytes (default 10 MB). */
    private int maxMessageSize = 10 * 1024 * 1024;
}

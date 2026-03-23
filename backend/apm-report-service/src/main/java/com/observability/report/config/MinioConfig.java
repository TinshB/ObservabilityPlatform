package com.observability.report.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class MinioConfig {

    private final MinioProperties minioProperties;

    @Bean
    public MinioClient minioClient() throws Exception {
        MinioClient client = MinioClient.builder()
                .endpoint(minioProperties.getUrl())
                .credentials(minioProperties.getAccessKey(), minioProperties.getSecretKey())
                .build();

        // Auto-create the bucket if it doesn't exist
        boolean exists = client.bucketExists(
                BucketExistsArgs.builder().bucket(minioProperties.getBucket()).build());
        if (!exists) {
            client.makeBucket(
                    MakeBucketArgs.builder().bucket(minioProperties.getBucket()).build());
            log.info("Created MinIO bucket: {}", minioProperties.getBucket());
        }

        return client;
    }
}

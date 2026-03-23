package com.observability.report.service;

import com.observability.report.config.MinioProperties;
import io.minio.*;
import io.minio.errors.ErrorResponseException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;

/**
 * MinIO object storage service for report PDF files.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MinioStorageService {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    /**
     * Upload a PDF byte array to MinIO. Returns the object key.
     */
    public String upload(String objectKey, byte[] data) {
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(objectKey)
                    .stream(new ByteArrayInputStream(data), data.length, -1)
                    .contentType("application/pdf")
                    .build());
            log.info("Uploaded report to MinIO: {}/{}", minioProperties.getBucket(), objectKey);
            return objectKey;
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload to MinIO: " + e.getMessage(), e);
        }
    }

    /**
     * Get an object's InputStream from MinIO.
     */
    public InputStream getObject(String objectKey) {
        try {
            return minioClient.getObject(GetObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(objectKey)
                    .build());
        } catch (Exception e) {
            throw new RuntimeException("Failed to download from MinIO: " + e.getMessage(), e);
        }
    }

    /**
     * Get the size of an object in MinIO.
     */
    public long getObjectSize(String objectKey) {
        try {
            StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(objectKey)
                    .build());
            return stat.size();
        } catch (Exception e) {
            log.warn("Failed to stat MinIO object {}: {}", objectKey, e.getMessage());
            return 0;
        }
    }

    /**
     * Delete an object from MinIO.
     */
    public void delete(String objectKey) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(objectKey)
                    .build());
            log.info("Deleted report from MinIO: {}/{}", minioProperties.getBucket(), objectKey);
        } catch (ErrorResponseException e) {
            if ("NoSuchKey".equals(e.errorResponse().code())) {
                log.warn("MinIO object already deleted: {}", objectKey);
            } else {
                log.warn("Failed to delete MinIO object {}: {}", objectKey, e.getMessage());
            }
        } catch (Exception e) {
            log.warn("Failed to delete MinIO object {}: {}", objectKey, e.getMessage());
        }
    }
}

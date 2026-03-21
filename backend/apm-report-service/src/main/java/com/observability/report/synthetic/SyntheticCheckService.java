package com.observability.report.synthetic;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.report.dto.*;
import com.observability.report.entity.SyntheticCheckEntity;
import com.observability.report.mapper.SyntheticMapper;
import com.observability.report.repository.SyntheticCheckRepository;
import com.observability.shared.exception.ConflictException;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Story 14.5 — CRUD service for synthetic checks.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyntheticCheckService {

    private final SyntheticCheckRepository checkRepository;
    private final SyntheticMapper syntheticMapper;
    private final ObjectMapper objectMapper;

    @Transactional
    public SyntheticCheckResponse createCheck(CreateSyntheticCheckRequest request, String createdBy) {
        if (checkRepository.existsByNameAndCreatedBy(request.getName(), createdBy)) {
            throw new ConflictException("Check with name '" + request.getName() + "' already exists");
        }

        SyntheticCheckEntity entity = SyntheticCheckEntity.builder()
                .name(request.getName())
                .serviceId(request.getServiceId())
                .serviceName(request.getServiceName())
                .url(request.getUrl())
                .httpMethod(request.getHttpMethod().toUpperCase())
                .requestHeaders(toJson(request.getRequestHeaders()))
                .requestBody(request.getRequestBody())
                .scheduleCron(request.getScheduleCron())
                .timeoutMs(request.getTimeoutMs())
                .expectedStatusCode(request.getExpectedStatusCode())
                .expectedBodyContains(request.getExpectedBodyContains())
                .maxLatencyMs(request.getMaxLatencyMs())
                .slaRuleId(request.getSlaRuleId())
                .active(true)
                .createdBy(createdBy)
                .build();

        entity = checkRepository.save(entity);
        log.info("Created synthetic check '{}' by {}", request.getName(), createdBy);
        return syntheticMapper.toCheckResponse(entity);
    }

    @Transactional(readOnly = true)
    public SyntheticCheckResponse getCheck(UUID checkId) {
        SyntheticCheckEntity entity = checkRepository.findById(checkId)
                .orElseThrow(() -> new ResourceNotFoundException("Synthetic check not found: " + checkId));
        return syntheticMapper.toCheckResponse(entity);
    }

    @Transactional(readOnly = true)
    public Page<SyntheticCheckResponse> listChecks(Boolean active, String serviceName, Pageable pageable) {
        Page<SyntheticCheckEntity> page = checkRepository.findWithFilters(active, serviceName, pageable);
        return page.map(syntheticMapper::toCheckResponse);
    }

    @Transactional
    public SyntheticCheckResponse updateCheck(UUID checkId, UpdateSyntheticCheckRequest request) {
        SyntheticCheckEntity entity = checkRepository.findById(checkId)
                .orElseThrow(() -> new ResourceNotFoundException("Synthetic check not found: " + checkId));

        if (request.getName() != null) entity.setName(request.getName());
        if (request.getUrl() != null) entity.setUrl(request.getUrl());
        if (request.getHttpMethod() != null) entity.setHttpMethod(request.getHttpMethod().toUpperCase());
        if (request.getRequestHeaders() != null) entity.setRequestHeaders(toJson(request.getRequestHeaders()));
        if (request.getRequestBody() != null) entity.setRequestBody(request.getRequestBody());
        if (request.getScheduleCron() != null) entity.setScheduleCron(request.getScheduleCron());
        if (request.getTimeoutMs() != null) entity.setTimeoutMs(request.getTimeoutMs());
        if (request.getExpectedStatusCode() != null) entity.setExpectedStatusCode(request.getExpectedStatusCode());
        if (request.getExpectedBodyContains() != null) entity.setExpectedBodyContains(request.getExpectedBodyContains());
        if (request.getMaxLatencyMs() != null) entity.setMaxLatencyMs(request.getMaxLatencyMs());
        if (request.getSlaRuleId() != null) entity.setSlaRuleId(request.getSlaRuleId());
        if (request.getActive() != null) entity.setActive(request.getActive());

        entity = checkRepository.save(entity);
        log.info("Updated synthetic check {}", checkId);
        return syntheticMapper.toCheckResponse(entity);
    }

    @Transactional
    public void deleteCheck(UUID checkId) {
        if (!checkRepository.existsById(checkId)) {
            throw new ResourceNotFoundException("Synthetic check not found: " + checkId);
        }
        checkRepository.deleteById(checkId);
        log.info("Deleted synthetic check {}", checkId);
    }

    @Transactional(readOnly = true)
    public List<SyntheticCheckEntity> getActiveChecks() {
        return checkRepository.findByActiveTrue();
    }

    private String toJson(java.util.Map<String, String> map) {
        if (map == null || map.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) {
            return null;
        }
    }
}

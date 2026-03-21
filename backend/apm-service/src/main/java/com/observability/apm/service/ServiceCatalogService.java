package com.observability.apm.service;

import com.observability.apm.dto.AutoRegisterRequest;
import com.observability.apm.dto.CreateServiceRequest;
import com.observability.apm.dto.ServiceFilterResponse;
import com.observability.apm.dto.ServiceResponse;
import com.observability.apm.dto.SignalToggleRequest;
import com.observability.apm.dto.UpdateServiceRequest;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ConflictException;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceCatalogService {

    private final ServiceRepository serviceRepository;

    // ── Story 4.5: Auto-register from OTel service.name ─────────────────────────

    @Transactional
    @CacheEvict(value = {"services", "service-filters"}, allEntries = true)
    public ServiceResponse autoRegister(AutoRegisterRequest request) {
        // Idempotent: if the service already exists, return it without error
        return serviceRepository.findByName(request.getServiceName())
                .map(existing -> {
                    log.debug("Service '{}' already registered, returning existing entry",
                            request.getServiceName());
                    return toResponse(existing);
                })
                .orElseGet(() -> {
                    ServiceEntity entity = ServiceEntity.builder()
                            .name(request.getServiceName())
                            .environment(request.getEnvironment())
                            .registrationSource("AUTO_DISCOVERED")
                            .metricsEnabled(true)
                            .logsEnabled(true)
                            .tracesEnabled(true)
                            .active(true)
                            .build();

                    entity = serviceRepository.save(entity);
                    log.info("Auto-registered new service '{}' from OTel pipeline",
                            entity.getName());

                    return toResponse(entity);
                });
    }

    // ── Story 4.6: Manual service registration ──────────────────────────────────

    @Transactional
    @CacheEvict(value = {"services", "service-filters"}, allEntries = true)
    public ServiceResponse createService(CreateServiceRequest request) {
        if (serviceRepository.existsByName(request.getName())) {
            throw new ConflictException("Service", request.getName());
        }

        ServiceEntity entity = ServiceEntity.builder()
                .name(request.getName())
                .description(request.getDescription())
                .ownerTeam(request.getOwnerTeam())
                .environment(request.getEnvironment())
                .tier(request.getTier())
                .registrationSource("MANUAL")
                .metricsEnabled(true)
                .logsEnabled(true)
                .tracesEnabled(true)
                .active(true)
                .build();

        entity = serviceRepository.save(entity);
        log.info("Manually registered service '{}' (team={}, env={})",
                entity.getName(), entity.getOwnerTeam(), entity.getEnvironment());

        return toResponse(entity);
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "services", allEntries = true),
            @CacheEvict(value = "service-by-id", key = "#id"),
            @CacheEvict(value = "service-filters", allEntries = true)
    })
    public ServiceResponse updateService(UUID id, UpdateServiceRequest request) {
        ServiceEntity entity = findById(id);

        if (request.getDescription() != null) {
            entity.setDescription(request.getDescription());
        }
        if (request.getOwnerTeam() != null) {
            entity.setOwnerTeam(request.getOwnerTeam());
        }
        if (request.getEnvironment() != null) {
            entity.setEnvironment(request.getEnvironment());
        }
        if (request.getTier() != null) {
            entity.setTier(request.getTier());
        }
        if (request.getActive() != null) {
            entity.setActive(request.getActive());
        }

        entity = serviceRepository.save(entity);
        log.info("Updated service '{}'", entity.getName());

        return toResponse(entity);
    }

    // ── Story 4.7: Signal toggle ────────────────────────────────────────────────

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "services", allEntries = true),
            @CacheEvict(value = "service-by-id", key = "#id")
    })
    public ServiceResponse toggleSignals(UUID id, SignalToggleRequest request) {
        ServiceEntity entity = findById(id);

        if (request.getMetricsEnabled() != null) {
            entity.setMetricsEnabled(request.getMetricsEnabled());
        }
        if (request.getLogsEnabled() != null) {
            entity.setLogsEnabled(request.getLogsEnabled());
        }
        if (request.getTracesEnabled() != null) {
            entity.setTracesEnabled(request.getTracesEnabled());
        }

        entity = serviceRepository.save(entity);
        log.info("Signal toggles updated for service '{}': metrics={}, logs={}, traces={}",
                entity.getName(), entity.isMetricsEnabled(),
                entity.isLogsEnabled(), entity.isTracesEnabled());

        return toResponse(entity);
    }

    // ── Read operations (Story 4.8 backend support) ─────────────────────────────

    @Transactional(readOnly = true)
    public Page<ServiceResponse> listServices(String search, String environment,
                                               String ownerTeam, String tier,
                                               Boolean isActive, Pageable pageable) {
        return serviceRepository.findWithFilters(search, environment, ownerTeam, tier, isActive, pageable)
                .map(this::toResponse);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "service-by-id", key = "#id")
    public ServiceResponse getServiceById(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "service-filters")
    public ServiceFilterResponse getFilterOptions() {
        return ServiceFilterResponse.builder()
                .environments(serviceRepository.findDistinctEnvironments())
                .teams(serviceRepository.findDistinctOwnerTeams())
                .tiers(serviceRepository.findDistinctTiers())
                .build();
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "services", allEntries = true),
            @CacheEvict(value = "service-by-id", key = "#id"),
            @CacheEvict(value = "service-filters", allEntries = true)
    })
    public void deactivateService(UUID id) {
        ServiceEntity entity = findById(id);
        entity.setActive(false);
        serviceRepository.save(entity);
        log.info("Deactivated service '{}'", entity.getName());
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private ServiceEntity findById(UUID id) {
        return serviceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Service", id.toString()));
    }

    private ServiceResponse toResponse(ServiceEntity entity) {
        return ServiceResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .ownerTeam(entity.getOwnerTeam())
                .environment(entity.getEnvironment())
                .tier(entity.getTier())
                .metricsEnabled(entity.isMetricsEnabled())
                .logsEnabled(entity.isLogsEnabled())
                .tracesEnabled(entity.isTracesEnabled())
                .active(entity.isActive())
                .registrationSource(entity.getRegistrationSource())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

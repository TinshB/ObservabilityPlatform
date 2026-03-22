package com.observability.billing.service;

import com.observability.billing.dto.CreateLicenceTierRequest;
import com.observability.billing.dto.LicenceTierResponse;
import com.observability.billing.dto.UpdateLicenceTierRequest;
import com.observability.billing.entity.LicenceTierEntity;
import com.observability.billing.repository.LicenceTierRepository;
import com.observability.shared.exception.ConflictException;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * US-BILL-009 — Licence tier CRUD service.
 * Manages licence tier lifecycle with user type uniqueness validation
 * and deletion guard for active tiers.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LicenceTierService {

    private final LicenceTierRepository licenceTierRepository;

    /**
     * AC1: Create a new licence tier with name, user type mapping, and monthly cost.
     */
    @Transactional
    public LicenceTierResponse createTier(CreateLicenceTierRequest request) {
        // Validate user type uniqueness
        if (licenceTierRepository.existsByUserTypeIgnoreCase(request.getUserType())) {
            throw new ConflictException(
                    "LICENCE_TIER_DUPLICATE",
                    "A licence tier for user type '" + request.getUserType() + "' already exists");
        }

        LicenceTierEntity entity = LicenceTierEntity.builder()
                .tierName(request.getTierName())
                .userType(request.getUserType().toUpperCase())
                .monthlyCostUsd(request.getMonthlyCostUsd())
                .active(true)
                .build();

        entity = licenceTierRepository.save(entity);
        log.info("Created licence tier '{}' (type={}, cost=${})",
                entity.getTierName(), entity.getUserType(), entity.getMonthlyCostUsd());

        return toResponse(entity);
    }

    /**
     * AC2: Update a licence tier — system updates cost and recalculates projected totals.
     */
    @Transactional
    public LicenceTierResponse updateTier(UUID id, UpdateLicenceTierRequest request) {
        LicenceTierEntity entity = findById(id);

        // Validate user type uniqueness if changing
        if (request.getUserType() != null && !request.getUserType().isBlank()) {
            String newType = request.getUserType().toUpperCase();
            if (!newType.equals(entity.getUserType())
                    && licenceTierRepository.existsByUserTypeIgnoreCaseAndIdNot(newType, id)) {
                throw new ConflictException(
                        "LICENCE_TIER_DUPLICATE",
                        "A licence tier for user type '" + newType + "' already exists");
            }
            entity.setUserType(newType);
        }

        if (request.getTierName() != null && !request.getTierName().isBlank()) {
            entity.setTierName(request.getTierName());
        }
        if (request.getMonthlyCostUsd() != null) {
            entity.setMonthlyCostUsd(request.getMonthlyCostUsd());
        }
        if (request.getActive() != null) {
            entity.setActive(request.getActive());
        }

        entity = licenceTierRepository.save(entity);
        log.info("Updated licence tier '{}' (id={})", entity.getTierName(), id);

        return toResponse(entity);
    }

    /**
     * AC3: Delete a tier — block deletion if tier is active with warning.
     */
    @Transactional
    public void deleteTier(UUID id) {
        LicenceTierEntity entity = findById(id);

        if (entity.isActive()) {
            throw new ConflictException(
                    "LICENCE_TIER_ACTIVE",
                    "Cannot delete active licence tier '" + entity.getTierName()
                            + "'. Deactivate it first or reassign users.");
        }

        licenceTierRepository.delete(entity);
        log.info("Deleted licence tier '{}' (id={})", entity.getTierName(), id);
    }

    @Transactional(readOnly = true)
    public LicenceTierResponse getTier(UUID id) {
        return toResponse(findById(id));
    }

    @Transactional(readOnly = true)
    public List<LicenceTierResponse> listAllTiers() {
        return licenceTierRepository.findAllByOrderByTierNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<LicenceTierResponse> listActiveTiers() {
        return licenceTierRepository.findByActiveTrueOrderByTierNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    private LicenceTierEntity findById(UUID id) {
        return licenceTierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "LICENCE_TIER_NOT_FOUND",
                        "Licence tier not found: " + id));
    }

    private LicenceTierResponse toResponse(LicenceTierEntity entity) {
        return LicenceTierResponse.builder()
                .id(entity.getId())
                .tierName(entity.getTierName())
                .userType(entity.getUserType())
                .monthlyCostUsd(entity.getMonthlyCostUsd())
                .active(entity.isActive())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}

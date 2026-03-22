package com.observability.billing.repository;

import com.observability.billing.entity.LicenceTierEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * US-BILL-009 — Repository for licence tier CRUD operations.
 */
@Repository
public interface LicenceTierRepository extends JpaRepository<LicenceTierEntity, UUID> {

    List<LicenceTierEntity> findAllByOrderByTierNameAsc();

    List<LicenceTierEntity> findByActiveTrueOrderByTierNameAsc();

    Optional<LicenceTierEntity> findByUserTypeIgnoreCase(String userType);

    boolean existsByUserTypeIgnoreCaseAndIdNot(String userType, UUID id);

    boolean existsByUserTypeIgnoreCase(String userType);
}

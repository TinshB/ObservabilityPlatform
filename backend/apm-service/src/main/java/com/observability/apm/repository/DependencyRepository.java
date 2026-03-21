package com.observability.apm.repository;

import com.observability.apm.entity.DependencyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Story 11.3 — Repository for service dependencies.
 */
@Repository
public interface DependencyRepository extends JpaRepository<DependencyEntity, UUID> {

    /** All dependencies originating from a given service. */
    List<DependencyEntity> findBySourceServiceIdAndActiveTrue(UUID sourceServiceId);

    /** All active dependencies across all services. */
    List<DependencyEntity> findByActiveTrue();

    /** Lookup for upsert — find existing dependency by the unique constraint columns. */
    Optional<DependencyEntity> findBySourceServiceIdAndTargetServiceNameAndDependencyType(
            UUID sourceServiceId, String targetServiceName, String dependencyType);

    /** Dependencies filtered by type. */
    List<DependencyEntity> findBySourceServiceIdAndDependencyTypeAndActiveTrue(
            UUID sourceServiceId, String dependencyType);

    /** Find all dependencies where a service appears as a target (reverse lookup). */
    @Query("""
            SELECT d FROM DependencyEntity d
            WHERE d.targetServiceName = :serviceName
              AND d.active = true
            """)
    List<DependencyEntity> findByTargetServiceName(@Param("serviceName") String serviceName);
}

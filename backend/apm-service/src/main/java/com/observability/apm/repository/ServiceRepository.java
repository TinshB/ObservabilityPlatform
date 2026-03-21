package com.observability.apm.repository;

import com.observability.apm.entity.ServiceEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ServiceRepository extends JpaRepository<ServiceEntity, UUID> {

    Optional<ServiceEntity> findByName(String name);

    boolean existsByName(String name);

    @Query("""
            SELECT s FROM ServiceEntity s
            WHERE (:search IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR LOWER(s.description) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
              AND (:environment IS NULL OR s.environment = :environment)
              AND (:ownerTeam IS NULL OR s.ownerTeam = :ownerTeam)
              AND (:tier IS NULL OR s.tier = :tier)
              AND (:isActive IS NULL OR s.active = :isActive)
            """)
    Page<ServiceEntity> findWithFilters(
            @Param("search") String search,
            @Param("environment") String environment,
            @Param("ownerTeam") String ownerTeam,
            @Param("tier") String tier,
            @Param("isActive") Boolean isActive,
            Pageable pageable);

    @Query("SELECT DISTINCT s.environment FROM ServiceEntity s WHERE s.environment IS NOT NULL ORDER BY s.environment")
    java.util.List<String> findDistinctEnvironments();

    @Query("SELECT DISTINCT s.ownerTeam FROM ServiceEntity s WHERE s.ownerTeam IS NOT NULL ORDER BY s.ownerTeam")
    java.util.List<String> findDistinctOwnerTeams();

    @Query("SELECT DISTINCT s.tier FROM ServiceEntity s WHERE s.tier IS NOT NULL ORDER BY s.tier")
    java.util.List<String> findDistinctTiers();
}

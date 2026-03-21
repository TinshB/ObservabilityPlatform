package com.observability.apm.repository;

import com.observability.apm.entity.DashboardEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Story 13.1 — Dashboard repository.
 */
@Repository
public interface DashboardRepository extends JpaRepository<DashboardEntity, UUID> {

    Optional<DashboardEntity> findByNameAndOwnerId(String name, UUID ownerId);

    @Query(value = """
            SELECT d.* FROM dashboards d
            WHERE (:ownerId IS NULL OR d.owner_id = CAST(:ownerId AS uuid))
              AND (:isTemplate IS NULL OR d.is_template = :isTemplate)
              AND (:search IS NULL OR LOWER(d.name) LIKE LOWER('%' || CAST(:search AS text) || '%'))
            ORDER BY d.updated_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM dashboards d
            WHERE (:ownerId IS NULL OR d.owner_id = CAST(:ownerId AS uuid))
              AND (:isTemplate IS NULL OR d.is_template = :isTemplate)
              AND (:search IS NULL OR LOWER(d.name) LIKE LOWER('%' || CAST(:search AS text) || '%'))
            """,
            nativeQuery = true)
    Page<DashboardEntity> findWithFilters(
            @Param("ownerId") UUID ownerId,
            @Param("isTemplate") Boolean isTemplate,
            @Param("search") String search,
            Pageable pageable);

    List<DashboardEntity> findByTemplateTrueOrderByNameAsc();
}

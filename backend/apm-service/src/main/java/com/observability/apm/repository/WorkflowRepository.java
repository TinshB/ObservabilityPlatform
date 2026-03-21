package com.observability.apm.repository;

import com.observability.apm.entity.WorkflowEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkflowRepository extends JpaRepository<WorkflowEntity, UUID> {

    Optional<WorkflowEntity> findByName(String name);

    List<WorkflowEntity> findByEnabledTrueAndActiveTrue();

    @Query("""
            SELECT w FROM WorkflowEntity w
            WHERE (:enabled IS NULL OR w.enabled = :enabled)
              AND (:active IS NULL OR w.active = :active)
            ORDER BY w.createdAt DESC
            """)
    Page<WorkflowEntity> findWithFilters(
            @Param("enabled") Boolean enabled,
            @Param("active") Boolean active,
            Pageable pageable);
}

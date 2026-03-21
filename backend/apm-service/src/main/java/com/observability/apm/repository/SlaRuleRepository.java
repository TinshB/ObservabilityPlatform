package com.observability.apm.repository;

import com.observability.apm.entity.SlaRuleEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SlaRuleRepository extends JpaRepository<SlaRuleEntity, UUID> {

    /** Find all enabled rules (used by the Alert Engine on each evaluation cycle). */
    List<SlaRuleEntity> findByEnabledTrue();

    /** Find rules for a specific service. */
    Page<SlaRuleEntity> findByServiceId(UUID serviceId, Pageable pageable);

    /** Filter rules by service and/or enabled status. */
    @Query("""
            SELECT r FROM SlaRuleEntity r
            WHERE (:serviceId IS NULL OR r.serviceId = :serviceId)
              AND (:enabled IS NULL OR r.enabled = :enabled)
            ORDER BY r.createdAt DESC
            """)
    Page<SlaRuleEntity> findWithFilters(
            @Param("serviceId") UUID serviceId,
            @Param("enabled") Boolean enabled,
            Pageable pageable);
}

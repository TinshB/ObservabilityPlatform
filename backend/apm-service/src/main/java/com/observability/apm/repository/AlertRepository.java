package com.observability.apm.repository;

import com.observability.apm.entity.AlertEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AlertRepository extends JpaRepository<AlertEntity, UUID> {

    /** Find the active (non-RESOLVED) alert for a given SLA rule, if any. */
    Optional<AlertEntity> findBySlaRuleIdAndStateNot(UUID slaRuleId, String state);

    /** Find all active alerts (PENDING or FIRING). */
    List<AlertEntity> findByStateIn(List<String> states);

    /** Paginated alert list with optional filters. */
    @Query("""
            SELECT a FROM AlertEntity a
            WHERE (:serviceId IS NULL OR a.serviceId = :serviceId)
              AND (:state IS NULL OR a.state = :state)
              AND (:severity IS NULL OR a.severity = :severity)
            ORDER BY a.updatedAt DESC
            """)
    Page<AlertEntity> findWithFilters(
            @Param("serviceId") UUID serviceId,
            @Param("state") String state,
            @Param("severity") String severity,
            Pageable pageable);

    /** Story 11.1: Historical alerts with time-range filtering. */
    @Query("""
            SELECT a FROM AlertEntity a
            WHERE (:serviceId IS NULL OR a.serviceId = :serviceId)
              AND (:state IS NULL OR a.state = :state)
              AND (:severity IS NULL OR a.severity = :severity)
              AND (CAST(:start AS timestamp) IS NULL OR a.createdAt >= :start)
              AND (CAST(:end AS timestamp) IS NULL OR a.createdAt <= :end)
            ORDER BY a.createdAt DESC
            """)
    Page<AlertEntity> findAlertHistory(
            @Param("serviceId") UUID serviceId,
            @Param("state") String state,
            @Param("severity") String severity,
            @Param("start") Instant start,
            @Param("end") Instant end,
            Pageable pageable);

    /** Story 11.1: Count alerts grouped by state in a time range — used for summary stats. */
    @Query("""
            SELECT a.state, COUNT(a) FROM AlertEntity a
            WHERE (:serviceId IS NULL OR a.serviceId = :serviceId)
              AND (CAST(:start AS timestamp) IS NULL OR a.createdAt >= :start)
              AND (CAST(:end AS timestamp) IS NULL OR a.createdAt <= :end)
            GROUP BY a.state
            """)
    List<Object[]> countByStateInRange(
            @Param("serviceId") UUID serviceId,
            @Param("start") Instant start,
            @Param("end") Instant end);
}

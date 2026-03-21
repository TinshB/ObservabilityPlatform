package com.observability.apm.repository;

import com.observability.apm.entity.WorkflowInstanceEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkflowInstanceRepository extends JpaRepository<WorkflowInstanceEntity, UUID> {

    Optional<WorkflowInstanceEntity> findByWorkflowIdAndTraceId(UUID workflowId, String traceId);

    @Query(value = """
            SELECT i.* FROM workflow_instances i
            WHERE i.workflow_id = :workflowId
              AND (:status IS NULL OR i.status = CAST(:status AS VARCHAR))
              AND (CAST(:from AS TIMESTAMPTZ) IS NULL OR i.started_at >= CAST(:from AS TIMESTAMPTZ))
              AND (CAST(:to AS TIMESTAMPTZ) IS NULL OR i.started_at <= CAST(:to AS TIMESTAMPTZ))
            ORDER BY i.created_at DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM workflow_instances i
            WHERE i.workflow_id = :workflowId
              AND (:status IS NULL OR i.status = CAST(:status AS VARCHAR))
              AND (CAST(:from AS TIMESTAMPTZ) IS NULL OR i.started_at >= CAST(:from AS TIMESTAMPTZ))
              AND (CAST(:to AS TIMESTAMPTZ) IS NULL OR i.started_at <= CAST(:to AS TIMESTAMPTZ))
            """,
            nativeQuery = true)
    Page<WorkflowInstanceEntity> findWithFilters(
            @Param("workflowId") UUID workflowId,
            @Param("status") String status,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    long countByWorkflowId(UUID workflowId);

    long countByWorkflowIdAndStatus(UUID workflowId, String status);

    @Query("""
            SELECT COALESCE(AVG(i.totalDurationMs), 0)
            FROM WorkflowInstanceEntity i
            WHERE i.workflowId = :workflowId
              AND i.totalDurationMs IS NOT NULL
            """)
    double avgDurationMsByWorkflowId(@Param("workflowId") UUID workflowId);

    @Query("""
            SELECT COALESCE(MAX(i.totalDurationMs), 0)
            FROM WorkflowInstanceEntity i
            WHERE i.workflowId = :workflowId
              AND i.totalDurationMs IS NOT NULL
            """)
    long maxDurationMsByWorkflowId(@Param("workflowId") UUID workflowId);

    @Query("""
            SELECT COALESCE(MIN(i.totalDurationMs), 0)
            FROM WorkflowInstanceEntity i
            WHERE i.workflowId = :workflowId
              AND i.totalDurationMs IS NOT NULL
            """)
    long minDurationMsByWorkflowId(@Param("workflowId") UUID workflowId);
}

package com.observability.apm.repository;

import com.observability.apm.entity.WorkflowStepEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkflowStepRepository extends JpaRepository<WorkflowStepEntity, UUID> {

    List<WorkflowStepEntity> findByWorkflowIdOrderByStepOrderAsc(UUID workflowId);

    List<WorkflowStepEntity> findByWorkflowIdAndStepOrder(UUID workflowId, int stepOrder);

    long countByWorkflowId(UUID workflowId);

    void deleteByWorkflowId(UUID workflowId);

    @Query("SELECT COALESCE(MAX(s.stepOrder), 0) FROM WorkflowStepEntity s WHERE s.workflowId = :workflowId")
    int findMaxStepOrder(UUID workflowId);

    @Modifying
    @Query("UPDATE WorkflowStepEntity s SET s.stepOrder = s.stepOrder + 1 WHERE s.workflowId = :workflowId AND s.stepOrder >= :fromOrder")
    void shiftStepOrdersUp(UUID workflowId, int fromOrder);
}

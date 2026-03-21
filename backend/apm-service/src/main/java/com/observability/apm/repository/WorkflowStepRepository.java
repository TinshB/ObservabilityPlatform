package com.observability.apm.repository;

import com.observability.apm.entity.WorkflowStepEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface WorkflowStepRepository extends JpaRepository<WorkflowStepEntity, UUID> {

    List<WorkflowStepEntity> findByWorkflowIdOrderByStepOrderAsc(UUID workflowId);

    Optional<WorkflowStepEntity> findByWorkflowIdAndStepOrder(UUID workflowId, int stepOrder);

    long countByWorkflowId(UUID workflowId);

    void deleteByWorkflowId(UUID workflowId);
}

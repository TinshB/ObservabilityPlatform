package com.observability.apm.repository;

import com.observability.apm.entity.WorkflowInstanceStepEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkflowInstanceStepRepository extends JpaRepository<WorkflowInstanceStepEntity, UUID> {

    List<WorkflowInstanceStepEntity> findByInstanceId(UUID instanceId);

    List<WorkflowInstanceStepEntity> findByInstanceIdOrderByStartedAtAsc(UUID instanceId);
}

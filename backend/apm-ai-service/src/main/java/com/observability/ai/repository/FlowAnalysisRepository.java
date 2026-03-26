package com.observability.ai.repository;

import com.observability.ai.entity.FlowAnalysisEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface FlowAnalysisRepository extends JpaRepository<FlowAnalysisEntity, UUID> {

    List<FlowAnalysisEntity> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<FlowAnalysisEntity> findByStatus(String status);

    List<FlowAnalysisEntity> findByExpiresAtBefore(OffsetDateTime now);
}

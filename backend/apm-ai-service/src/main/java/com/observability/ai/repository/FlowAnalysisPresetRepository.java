package com.observability.ai.repository;

import com.observability.ai.entity.FlowAnalysisPresetEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FlowAnalysisPresetRepository extends JpaRepository<FlowAnalysisPresetEntity, UUID> {

    List<FlowAnalysisPresetEntity> findByUserIdOrderByNameAsc(UUID userId);

    Optional<FlowAnalysisPresetEntity> findByUserIdAndName(UUID userId, String name);
}

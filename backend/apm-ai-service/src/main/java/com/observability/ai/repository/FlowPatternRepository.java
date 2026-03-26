package com.observability.ai.repository;

import com.observability.ai.entity.FlowPatternEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FlowPatternRepository extends JpaRepository<FlowPatternEntity, UUID> {

    List<FlowPatternEntity> findByAnalysisIdOrderByFrequencyDesc(UUID analysisId);
}

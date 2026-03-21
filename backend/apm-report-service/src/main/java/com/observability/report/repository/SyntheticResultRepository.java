package com.observability.report.repository;

import com.observability.report.entity.SyntheticResultEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface SyntheticResultRepository extends JpaRepository<SyntheticResultEntity, UUID> {

    Page<SyntheticResultEntity> findByCheckIdOrderByExecutedAtDesc(UUID checkId, Pageable pageable);

    List<SyntheticResultEntity> findTop10ByCheckIdOrderByExecutedAtDesc(UUID checkId);

    @Query("SELECT r FROM SyntheticResultEntity r WHERE r.checkId = :checkId "
            + "AND r.executedAt >= :since ORDER BY r.executedAt DESC")
    List<SyntheticResultEntity> findRecentByCheckId(
            @Param("checkId") UUID checkId,
            @Param("since") Instant since);

    long countByCheckIdAndSuccessTrue(UUID checkId);

    long countByCheckId(UUID checkId);
}

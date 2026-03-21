package com.observability.report.repository;

import com.observability.report.entity.ReportEntity;
import com.observability.report.entity.ReportStatus;
import com.observability.report.entity.ReportType;
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
public interface ReportRepository extends JpaRepository<ReportEntity, UUID> {

    Page<ReportEntity> findByRequestedByOrderByCreatedAtDesc(String requestedBy, Pageable pageable);

    Page<ReportEntity> findByReportTypeOrderByCreatedAtDesc(ReportType reportType, Pageable pageable);

    @Query("SELECT r FROM ReportEntity r WHERE "
            + "(:reportType IS NULL OR r.reportType = :reportType) "
            + "AND (:status IS NULL OR r.status = :status) "
            + "AND (:requestedBy IS NULL OR r.requestedBy = :requestedBy) "
            + "ORDER BY r.createdAt DESC")
    Page<ReportEntity> findWithFilters(
            @Param("reportType") ReportType reportType,
            @Param("status") ReportStatus status,
            @Param("requestedBy") String requestedBy,
            Pageable pageable);

    List<ReportEntity> findByStatusAndCreatedAtBefore(ReportStatus status, Instant cutoff);
}

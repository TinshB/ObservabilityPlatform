package com.observability.report.repository;

import com.observability.report.entity.ReportScheduleEntity;
import com.observability.report.entity.ReportType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ReportScheduleRepository extends JpaRepository<ReportScheduleEntity, UUID> {

    Page<ReportScheduleEntity> findByCreatedByOrderByCreatedAtDesc(String createdBy, Pageable pageable);

    Page<ReportScheduleEntity> findByReportTypeOrderByCreatedAtDesc(ReportType reportType, Pageable pageable);

    List<ReportScheduleEntity> findByActiveTrue();

    Page<ReportScheduleEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsByNameAndCreatedBy(String name, String createdBy);
}

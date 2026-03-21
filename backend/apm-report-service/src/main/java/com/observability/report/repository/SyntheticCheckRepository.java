package com.observability.report.repository;

import com.observability.report.entity.SyntheticCheckEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SyntheticCheckRepository extends JpaRepository<SyntheticCheckEntity, UUID> {

    List<SyntheticCheckEntity> findByActiveTrue();

    Page<SyntheticCheckEntity> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT c FROM SyntheticCheckEntity c WHERE "
            + "(:active IS NULL OR c.active = :active) "
            + "AND (:serviceName IS NULL OR c.serviceName = :serviceName) "
            + "ORDER BY c.createdAt DESC")
    Page<SyntheticCheckEntity> findWithFilters(
            @Param("active") Boolean active,
            @Param("serviceName") String serviceName,
            Pageable pageable);

    boolean existsByNameAndCreatedBy(String name, String createdBy);
}

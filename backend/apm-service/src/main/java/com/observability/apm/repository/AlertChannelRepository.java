package com.observability.apm.repository;

import com.observability.apm.entity.AlertChannelEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AlertChannelRepository extends JpaRepository<AlertChannelEntity, UUID> {

    List<AlertChannelEntity> findByEnabledTrue();
}

package com.observability.report.synthetic;

import com.observability.report.dto.SyntheticResultResponse;
import com.observability.report.mapper.SyntheticMapper;
import com.observability.report.repository.SyntheticResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Story 14.5 — Service for querying synthetic probe results.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyntheticResultService {

    private final SyntheticResultRepository resultRepository;
    private final SyntheticMapper syntheticMapper;

    @Transactional(readOnly = true)
    public Page<SyntheticResultResponse> getResults(UUID checkId, Pageable pageable) {
        return resultRepository.findByCheckIdOrderByExecutedAtDesc(checkId, pageable)
                .map(syntheticMapper::toResultResponse);
    }

    @Transactional(readOnly = true)
    public List<SyntheticResultResponse> getRecentResults(UUID checkId) {
        return resultRepository.findTop10ByCheckIdOrderByExecutedAtDesc(checkId)
                .stream()
                .map(syntheticMapper::toResultResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public double getSuccessRate(UUID checkId, int lastHours) {
        Instant since = Instant.now().minus(lastHours, ChronoUnit.HOURS);
        long total = resultRepository.countByCheckId(checkId);
        if (total == 0) return 100.0;
        long successes = resultRepository.countByCheckIdAndSuccessTrue(checkId);
        return (double) successes / total * 100;
    }
}

package com.observability.apm.service;

import com.observability.apm.dto.LogSearchResponse;
import com.observability.apm.elasticsearch.ElasticsearchLogClient;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.ServiceRepository;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Story 6.4 / 6.8 / 7.1 — Log search service.
 * Resolves service identity and delegates search to Elasticsearch.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LogSearchService {

    private final ServiceRepository serviceRepository;
    private final ElasticsearchLogClient esLogClient;

    /**
     * Search logs with filters and pagination.
     *
     * @param serviceId  service UUID filter (null = all services)
     * @param severities severity levels to include (null/empty = all)
     * @param searchText full-text search on log body (null/blank = no text filter)
     * @param traceId    trace ID for correlation (null = no trace filter)
     * @param start      range start
     * @param end        range end
     * @param page       zero-based page number
     * @param size       page size
     * @return paginated log search result
     */
    public LogSearchResponse searchLogs(UUID serviceId, List<String> severities,
                                         String searchText, String traceId,
                                         Instant start, Instant end,
                                         int page, int size) {
        String serviceName = null;
        if (serviceId != null) {
            ServiceEntity service = serviceRepository.findById(serviceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Service", serviceId.toString()));
            serviceName = service.getName();
        }

        int from = page * size;

        return esLogClient.searchLogs(serviceName, severities, searchText, traceId,
                start, end, from, size);
    }
}

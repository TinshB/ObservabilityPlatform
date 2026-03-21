package com.observability.auth.audit;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.IndexRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Service responsible for persisting audit events to Elasticsearch.
 * Failures in audit logging are caught and logged as warnings to avoid
 * disrupting the main application flow.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private static final String AUDIT_INDEX = "audit-events";

    private final ElasticsearchClient elasticsearchClient;

    /**
     * Index an audit event to the "audit-events" Elasticsearch index.
     *
     * @param event the audit event to persist
     */
    public void logEvent(AuditEvent event) {
        try {
            IndexRequest<AuditEvent> request = IndexRequest.of(builder ->
                    builder.index(AUDIT_INDEX)
                            .document(event)
            );

            elasticsearchClient.index(request);
            log.debug("Audit event indexed: action='{}', actor='{}', resource='{}'",
                    event.getAction(), event.getActor(), event.getResource());
        } catch (Exception ex) {
            log.warn("Failed to index audit event [action={}, actor={}]: {}",
                    event.getAction(), event.getActor(), ex.getMessage());
        }
    }
}

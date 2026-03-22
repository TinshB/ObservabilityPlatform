package com.observability.billing.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Elasticsearch connection properties for billing storage queries (US-BILL-001).
 */
@Data
@Component
@ConfigurationProperties(prefix = "elasticsearch")
public class ElasticsearchProperties {

    /** Elasticsearch base URL. */
    private String url = "http://localhost:9200";

    /** Log index pattern. */
    private String logIndex = "logs-*";

    /** Trace index pattern. */
    private String traceIndex = "jaeger-span-*";
}

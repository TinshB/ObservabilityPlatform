package com.observability.apm.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Elasticsearch connection properties for log metric aggregations (Story 6.3).
 */
@Data
@Component
@ConfigurationProperties(prefix = "elasticsearch")
public class ElasticsearchProperties {

    /** Elasticsearch base URL. */
    private String url = "http://localhost:9200";

    /** Log index pattern to query. */
    private String logIndex = "logs-*";
}

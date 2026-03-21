package com.observability.report.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "elasticsearch")
public class ElasticsearchProperties {

    /** Elasticsearch base URL. */
    private String url = "http://localhost:9200";

    /** Log index pattern to query. */
    private String logIndex = "logs-*";

    /** Alert index pattern to query. */
    private String alertIndex = "alerts-*";
}

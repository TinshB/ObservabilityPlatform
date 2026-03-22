package com.observability.billing.elasticsearch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.observability.billing.dto.IndexStorageDetail;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.client.Request;
import org.elasticsearch.client.Response;
import org.elasticsearch.client.RestClient;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * US-BILL-001 — Client for querying Elasticsearch storage statistics.
 * Uses the low-level RestClient for _cat/indices and _stats APIs
 * which are not exposed via the high-level ElasticsearchClient.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ElasticsearchStorageClient {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    /**
     * Fetch per-index storage details from Elasticsearch.
     *
     * @return list of index storage details (name, size bytes, doc count, shard count)
     */
    public List<IndexStorageDetail> getIndexStorageDetails() {
        try {
            Request request = new Request("GET", "/_cat/indices?format=json&bytes=b&h=index,store.size,docs.count,pri,rep");
            Response response = restClient.performRequest(request);

            try (InputStream is = response.getEntity().getContent()) {
                JsonNode indices = objectMapper.readTree(is);
                List<IndexStorageDetail> details = new ArrayList<>();

                for (JsonNode index : indices) {
                    String indexName = index.path("index").asText();

                    // Skip internal/system indices but keep data-stream backing indices (.ds-*)
                    if (indexName.startsWith(".") && !indexName.startsWith(".ds-")) {
                        continue;
                    }

                    long storeSize = index.path("store.size").asLong(0);
                    long docCount = index.path("docs.count").asLong(0);
                    int primaryShards = index.path("pri").asInt(0);
                    int replicaShards = index.path("rep").asInt(0);

                    details.add(IndexStorageDetail.builder()
                            .indexName(indexName)
                            .storageSizeBytes(storeSize)
                            .documentCount(docCount)
                            .primaryShardCount(primaryShards)
                            .replicaShardCount(replicaShards)
                            .totalShardCount(primaryShards + (primaryShards * replicaShards))
                            .build());
                }

                return details;
            }

        } catch (Exception ex) {
            log.error("Failed to fetch Elasticsearch index storage details: {}", ex.getMessage());
            return List.of();
        }
    }

    /**
     * Fetch cluster-level storage summary from Elasticsearch.
     *
     * @return total storage size in bytes across all non-system indices
     */
    public long getTotalStorageBytes() {
        try {
            Request request = new Request("GET", "/_stats/store");
            Response response = restClient.performRequest(request);

            try (InputStream is = response.getEntity().getContent()) {
                JsonNode root = objectMapper.readTree(is);
                return root.path("_all").path("total").path("store").path("size_in_bytes").asLong(0);
            }

        } catch (Exception ex) {
            log.error("Failed to fetch Elasticsearch total storage: {}", ex.getMessage());
            return 0;
        }
    }

    /**
     * Fetch total document count across all indices.
     *
     * @return total document count
     */
    public long getTotalDocumentCount() {
        try {
            Request request = new Request("GET", "/_stats/docs");
            Response response = restClient.performRequest(request);

            try (InputStream is = response.getEntity().getContent()) {
                JsonNode root = objectMapper.readTree(is);
                return root.path("_all").path("total").path("docs").path("count").asLong(0);
            }

        } catch (Exception ex) {
            log.error("Failed to fetch Elasticsearch total document count: {}", ex.getMessage());
            return 0;
        }
    }
}

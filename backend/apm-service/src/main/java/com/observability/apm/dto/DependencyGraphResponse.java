package com.observability.apm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Story 11.3 — Graph representation of service dependencies.
 * Contains nodes (services/databases/cloud components) and edges (dependency links).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DependencyGraphResponse {

    private List<DependencyNode> nodes;
    private List<DependencyEdge> edges;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DependencyNode {
        private String id;           // service name or target_service_name
        private String label;        // display name
        private String nodeType;     // SERVICE, DATABASE, CLOUD_COMPONENT
        private String serviceId;    // UUID if the node is a registered service, null otherwise
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DependencyEdge {
        private String id;              // dependency entity UUID
        private String source;          // source node id (service name)
        private String target;          // target node id
        private String dependencyType;  // HTTP, GRPC, DATABASE, CLOUD
        private long callCount1h;
        private long errorCount1h;
        private double avgLatencyMs1h;
    }
}

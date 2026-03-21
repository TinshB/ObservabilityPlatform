package com.observability.apm.prometheus;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * Maps the Prometheus HTTP API response format.
 *
 * <pre>
 * {
 *   "status": "success",
 *   "data": {
 *     "resultType": "matrix" | "vector",
 *     "result": [...]
 *   }
 * }
 * </pre>
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PrometheusResponse {

    private String status;
    private PromData data;
    private String errorType;
    private String error;

    public boolean isSuccess() {
        return "success".equals(status);
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PromData {
        private String resultType;
        private List<PromResult> result;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PromResult {
        private Map<String, String> metric;

        /** Instant query: single [timestamp, value] */
        private List<Object> value;

        /** Range query: list of [timestamp, value] pairs */
        private List<List<Object>> values;
    }
}

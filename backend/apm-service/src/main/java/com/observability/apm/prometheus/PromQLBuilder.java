package com.observability.apm.prometheus;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Fluent builder for constructing PromQL query strings.
 *
 * <pre>
 *   String query = PromQLBuilder.metric("http_server_request_duration_seconds_bucket")
 *       .label("service_name", serviceName)
 *       .label("http_response_status_code", "~", "5..")
 *       .rate("5m")
 *       .sumBy("le")
 *       .histogramQuantile(0.95)
 *       .build();
 * </pre>
 */
public class PromQLBuilder {

    private final String metricName;
    private final Map<String, LabelMatcher> labels = new LinkedHashMap<>();
    private String rateInterval;
    private String[] sumByLabels;
    private Double quantile;
    private boolean applySum;
    private String customWrapping;

    private PromQLBuilder(String metricName) {
        this.metricName = metricName;
    }

    public static PromQLBuilder metric(String metricName) {
        return new PromQLBuilder(metricName);
    }

    /** Exact label match: label="value" */
    public PromQLBuilder label(String key, String value) {
        labels.put(key, new LabelMatcher(key, "=", value));
        return this;
    }

    /** Custom label match operator: =, !=, =~, !~ */
    public PromQLBuilder label(String key, String operator, String value) {
        labels.put(key, new LabelMatcher(key, operator, value));
        return this;
    }

    /** Wraps the metric selector in rate() with the given interval. */
    public PromQLBuilder rate(String interval) {
        this.rateInterval = interval;
        return this;
    }

    /** Wraps in sum() with no by-clause. */
    public PromQLBuilder sum() {
        this.applySum = true;
        this.sumByLabels = null;
        return this;
    }

    /** Wraps in sum by(labels...). */
    public PromQLBuilder sumBy(String... labels) {
        this.applySum = true;
        this.sumByLabels = labels;
        return this;
    }

    /** Wraps the entire expression in histogram_quantile(quantile, ...). */
    public PromQLBuilder histogramQuantile(double quantile) {
        this.quantile = quantile;
        return this;
    }

    /** Wraps the entire expression in an arbitrary function call. */
    public PromQLBuilder wrap(String functionCall) {
        this.customWrapping = functionCall;
        return this;
    }

    public String build() {
        // 1. Build metric selector: metric_name{label1="v1", label2=~"v2"}
        StringBuilder selector = new StringBuilder(metricName);
        if (!labels.isEmpty()) {
            selector.append("{");
            boolean first = true;
            for (LabelMatcher m : labels.values()) {
                if (!first) selector.append(", ");
                selector.append(m.key).append(m.operator).append("\"").append(m.value).append("\"");
                first = false;
            }
            selector.append("}");
        }

        // 2. Optionally wrap in rate()
        String expr = selector.toString();
        if (rateInterval != null) {
            expr = "rate(" + expr + "[" + rateInterval + "])";
        }

        // 3. Optionally wrap in sum / sum by()
        if (applySum) {
            if (sumByLabels != null && sumByLabels.length > 0) {
                expr = "sum by(" + String.join(", ", sumByLabels) + ")(" + expr + ")";
            } else {
                expr = "sum(" + expr + ")";
            }
        }

        // 4. Optionally wrap in histogram_quantile()
        if (quantile != null) {
            expr = "histogram_quantile(" + quantile + ", " + expr + ")";
        }

        // 5. Optionally apply custom wrapping
        if (customWrapping != null) {
            expr = customWrapping + "(" + expr + ")";
        }

        return expr;
    }

    @Override
    public String toString() {
        return build();
    }

    private record LabelMatcher(String key, String operator, String value) {}
}

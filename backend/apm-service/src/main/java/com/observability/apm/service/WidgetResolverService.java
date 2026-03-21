package com.observability.apm.service;

import com.observability.apm.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Story 13.2 + 13.3 — Orchestrator service for resolving widget data.
 * <p>
 * Handles:
 * <ul>
 *   <li>Template variable substitution in queries (Story 13.3)</li>
 *   <li>Dispatching to the correct resolver via strategy pattern</li>
 *   <li>Parallel execution with per-widget error isolation</li>
 * </ul>
 */
@Slf4j
@Service
public class WidgetResolverService {

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\$([a-zA-Z_][a-zA-Z0-9_]*)");

    /**
     * Matches a label matcher whose value is empty or an unresolved $variable, e.g.:
     *   job=""           job=~""           environment=""
     *   job="$service"   environment="$env"
     * Handles optional leading comma or trailing comma so the selector stays valid.
     */
    private static final Pattern EMPTY_LABEL_PATTERN = Pattern.compile(
            ",?\\s*[a-zA-Z_][a-zA-Z0-9_]*\\s*=~?\\s*\"(\\$[a-zA-Z_][a-zA-Z0-9_]*)?\"\\s*,?");

    private final Map<DataSourceType, WidgetDataResolver> resolvers;

    public WidgetResolverService(
            PrometheusWidgetResolver prometheusResolver,
            ElasticsearchWidgetResolver elasticsearchResolver,
            JaegerWidgetResolver jaegerResolver,
            PostgresWidgetResolver postgresResolver) {
        this.resolvers = Map.of(
                DataSourceType.PROMETHEUS, prometheusResolver,
                DataSourceType.ELASTICSEARCH, elasticsearchResolver,
                DataSourceType.JAEGER, jaegerResolver,
                DataSourceType.POSTGRESQL, postgresResolver
        );
    }

    /**
     * Resolve data for a batch of widgets in parallel.
     * Variables are substituted into each widget's query before dispatching.
     */
    public BatchWidgetResolveResponse resolveBatch(BatchWidgetResolveRequest request) {
        Map<String, String> variables = request.getVariables() != null
                ? request.getVariables() : Map.of();

        List<CompletableFuture<WidgetDataResponse>> futures = new ArrayList<>();

        for (WidgetDataRequest widget : request.getWidgets()) {
            futures.add(CompletableFuture.supplyAsync(() -> resolveWidget(widget, variables)));
        }

        List<WidgetDataResponse> results = futures.stream()
                .map(CompletableFuture::join)
                .toList();

        return BatchWidgetResolveResponse.builder()
                .results(results)
                .build();
    }

    /**
     * Resolve data for a single widget with variable substitution.
     */
    private WidgetDataResponse resolveWidget(WidgetDataRequest request, Map<String, String> variables) {
        try {
            // Substitute template variables in the query
            String substitutedQuery = substituteVariables(request.getQuery(), variables);
            WidgetDataRequest resolved = WidgetDataRequest.builder()
                    .widgetId(request.getWidgetId())
                    .dataSourceType(request.getDataSourceType())
                    .query(substitutedQuery)
                    .params(request.getParams())
                    .start(request.getStart())
                    .end(request.getEnd())
                    .stepSeconds(request.getStepSeconds())
                    .build();

            WidgetDataResolver resolver = resolvers.get(request.getDataSourceType());
            if (resolver == null) {
                return WidgetDataResponse.builder()
                        .widgetId(request.getWidgetId())
                        .timeSeries(List.of())
                        .error("Unsupported data source type: " + request.getDataSourceType())
                        .build();
            }

            return resolver.resolve(resolved);

        } catch (Exception ex) {
            log.error("Widget resolution failed for [{}]: {}", request.getWidgetId(), ex.getMessage());
            return WidgetDataResponse.builder()
                    .widgetId(request.getWidgetId())
                    .timeSeries(List.of())
                    .error("Resolution failed: " + ex.getMessage())
                    .build();
        }
    }

    /**
     * Substitute $varName placeholders in a query string with provided variable values.
     * Variables that are empty or not provided are left as $placeholders, then
     * {@link #stripEmptyLabelMatchers} removes the entire label matcher so
     * Prometheus returns data for all values of that label.
     */
    String substituteVariables(String query, Map<String, String> variables) {
        if (query == null) {
            return query;
        }

        // Step 1: replace $varName with the value (or leave as-is if blank/missing)
        Matcher matcher = VARIABLE_PATTERN.matcher(query);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String varName = matcher.group(1);
            String value = variables.get(varName);
            // If the variable is provided and non-blank, substitute it; otherwise keep the placeholder
            String replacement = (value != null && !value.isBlank()) ? value : matcher.group(0);
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);

        // Step 2: strip label matchers with empty values or unresolved $variables
        return stripEmptyLabelMatchers(sb.toString());
    }

    /**
     * Remove label matchers whose value is empty ("") or an unresolved $variable
     * from PromQL selectors. Fixes dangling commas and empty selectors.
     * <p>
     * Examples:
     * <pre>
     *   {job="$service",environment="prod"}  → {environment="prod"}
     *   {job="",environment=""}              → {}
     *   {job="myapp",environment="$env"}     → {job="myapp"}
     * </pre>
     */
    String stripEmptyLabelMatchers(String query) {
        // Remove matchers with empty or $variable values
        String result = EMPTY_LABEL_PATTERN.matcher(query).replaceAll(mr -> {
            // If the match consumed commas on both sides, put one back
            String m = mr.group();
            boolean leadingComma = m.startsWith(",");
            boolean trailingComma = m.endsWith(",");
            return (leadingComma && trailingComma) ? "," : "";
        });

        // Clean up: remove leading/trailing commas inside braces  {,x="y"} or {x="y",}
        result = result.replaceAll("\\{\\s*,", "{");
        result = result.replaceAll(",\\s*}", "}");

        return result;
    }
}

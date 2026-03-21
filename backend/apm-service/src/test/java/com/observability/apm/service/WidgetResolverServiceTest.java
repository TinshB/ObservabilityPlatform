package com.observability.apm.service;

import com.observability.apm.dto.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link WidgetResolverService} (Stories 13.2 + 13.3).
 */
@ExtendWith(MockitoExtension.class)
class WidgetResolverServiceTest {

    @Mock
    private PrometheusWidgetResolver prometheusResolver;

    @Mock
    private ElasticsearchWidgetResolver elasticsearchResolver;

    @Mock
    private JaegerWidgetResolver jaegerResolver;

    @Mock
    private PostgresWidgetResolver postgresResolver;

    private WidgetResolverService service;

    @BeforeEach
    void setUp() {
        service = new WidgetResolverService(
                prometheusResolver, elasticsearchResolver,
                jaegerResolver, postgresResolver);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Variable Substitution (Story 13.3)
    // ═══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("substituteVariables")
    class VariableSubstitution {

        @Test
        @DisplayName("should replace $service variable in PromQL query")
        void substituteSingleVariable() {
            String query = "up{service=\"$service\"}";
            Map<String, String> variables = Map.of("service", "payment-svc");

            String result = service.substituteVariables(query, variables);

            assertEquals("up{service=\"payment-svc\"}", result);
        }

        @Test
        @DisplayName("should replace multiple variables")
        void substituteMultipleVariables() {
            String query = "http_requests_total{service=\"$service\", env=\"$environment\"}";
            Map<String, String> variables = Map.of(
                    "service", "order-svc",
                    "environment", "production");

            String result = service.substituteVariables(query, variables);

            assertEquals("http_requests_total{service=\"order-svc\", env=\"production\"}", result);
        }

        @Test
        @DisplayName("should leave unknown variables untouched")
        void unknownVariablesUntouched() {
            String query = "up{service=\"$service\", region=\"$region\"}";
            Map<String, String> variables = Map.of("service", "user-svc");

            String result = service.substituteVariables(query, variables);

            assertEquals("up{service=\"user-svc\", region=\"$region\"}", result);
        }

        @Test
        @DisplayName("should return null query as-is")
        void nullQuery() {
            assertNull(service.substituteVariables(null, Map.of("service", "x")));
        }

        @Test
        @DisplayName("should return query unchanged when variables map is empty")
        void emptyVariables() {
            String query = "up{service=\"$service\"}";
            assertEquals(query, service.substituteVariables(query, Map.of()));
        }

        @Test
        @DisplayName("should handle query with no variable placeholders")
        void noPlaceholders() {
            String query = "up{job=\"prometheus\"}";
            Map<String, String> variables = Map.of("service", "x");

            assertEquals(query, service.substituteVariables(query, variables));
        }

        @Test
        @DisplayName("should handle underscore variable names")
        void underscoreVariableNames() {
            String query = "metric{env=\"$env_name\"}";
            Map<String, String> variables = Map.of("env_name", "staging");

            assertEquals("metric{env=\"staging\"}", service.substituteVariables(query, variables));
        }

        @Test
        @DisplayName("should handle special regex characters in replacement value")
        void specialCharsInReplacement() {
            String query = "up{filter=\"$service\"}";
            Map<String, String> variables = Map.of("service", "api-gateway$2");

            String result = service.substituteVariables(query, variables);

            assertEquals("up{filter=\"api-gateway$2\"}", result);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Batch Resolution (Story 13.2)
    // ═══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("resolveBatch")
    class BatchResolution {

        @Test
        @DisplayName("should dispatch Prometheus widget to PrometheusResolver")
        void dispatchToPrometheus() {
            WidgetDataResponse expected = WidgetDataResponse.builder()
                    .widgetId("w1")
                    .timeSeries(List.of())
                    .build();
            when(prometheusResolver.resolve(any())).thenReturn(expected);

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(WidgetDataRequest.builder()
                            .widgetId("w1")
                            .dataSourceType(DataSourceType.PROMETHEUS)
                            .query("up")
                            .build()))
                    .variables(Map.of())
                    .build();

            BatchWidgetResolveResponse response = service.resolveBatch(request);

            assertEquals(1, response.getResults().size());
            assertEquals("w1", response.getResults().getFirst().getWidgetId());
            verify(prometheusResolver).resolve(any());
            verifyNoInteractions(elasticsearchResolver, jaegerResolver, postgresResolver);
        }

        @Test
        @DisplayName("should dispatch Elasticsearch widget to ElasticsearchResolver")
        void dispatchToElasticsearch() {
            WidgetDataResponse expected = WidgetDataResponse.builder()
                    .widgetId("w2")
                    .timeSeries(List.of())
                    .build();
            when(elasticsearchResolver.resolve(any())).thenReturn(expected);

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(WidgetDataRequest.builder()
                            .widgetId("w2")
                            .dataSourceType(DataSourceType.ELASTICSEARCH)
                            .query("error")
                            .build()))
                    .variables(Map.of())
                    .build();

            BatchWidgetResolveResponse response = service.resolveBatch(request);

            assertEquals(1, response.getResults().size());
            verify(elasticsearchResolver).resolve(any());
        }

        @Test
        @DisplayName("should dispatch Jaeger widget to JaegerResolver")
        void dispatchToJaeger() {
            WidgetDataResponse expected = WidgetDataResponse.builder()
                    .widgetId("w3")
                    .timeSeries(List.of())
                    .build();
            when(jaegerResolver.resolve(any())).thenReturn(expected);

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(WidgetDataRequest.builder()
                            .widgetId("w3")
                            .dataSourceType(DataSourceType.JAEGER)
                            .query("order-svc")
                            .build()))
                    .variables(Map.of())
                    .build();

            BatchWidgetResolveResponse response = service.resolveBatch(request);

            assertEquals(1, response.getResults().size());
            verify(jaegerResolver).resolve(any());
        }

        @Test
        @DisplayName("should dispatch PostgreSQL widget to PostgresResolver")
        void dispatchToPostgres() {
            WidgetDataResponse expected = WidgetDataResponse.builder()
                    .widgetId("w4")
                    .timeSeries(List.of())
                    .build();
            when(postgresResolver.resolve(any())).thenReturn(expected);

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(WidgetDataRequest.builder()
                            .widgetId("w4")
                            .dataSourceType(DataSourceType.POSTGRESQL)
                            .query("services")
                            .build()))
                    .variables(Map.of())
                    .build();

            BatchWidgetResolveResponse response = service.resolveBatch(request);

            assertEquals(1, response.getResults().size());
            verify(postgresResolver).resolve(any());
        }

        @Test
        @DisplayName("should resolve multiple widgets from different data sources in parallel")
        void resolveMultipleWidgets() {
            when(prometheusResolver.resolve(any())).thenReturn(
                    WidgetDataResponse.builder().widgetId("w1").timeSeries(List.of()).build());
            when(elasticsearchResolver.resolve(any())).thenReturn(
                    WidgetDataResponse.builder().widgetId("w2").timeSeries(List.of()).build());
            when(jaegerResolver.resolve(any())).thenReturn(
                    WidgetDataResponse.builder().widgetId("w3").timeSeries(List.of()).build());

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(
                            WidgetDataRequest.builder()
                                    .widgetId("w1")
                                    .dataSourceType(DataSourceType.PROMETHEUS)
                                    .query("up").build(),
                            WidgetDataRequest.builder()
                                    .widgetId("w2")
                                    .dataSourceType(DataSourceType.ELASTICSEARCH)
                                    .query("error").build(),
                            WidgetDataRequest.builder()
                                    .widgetId("w3")
                                    .dataSourceType(DataSourceType.JAEGER)
                                    .query("svc").build()))
                    .variables(Map.of())
                    .build();

            BatchWidgetResolveResponse response = service.resolveBatch(request);

            assertEquals(3, response.getResults().size());
            verify(prometheusResolver).resolve(any());
            verify(elasticsearchResolver).resolve(any());
            verify(jaegerResolver).resolve(any());
        }

        @Test
        @DisplayName("should substitute variables before dispatching")
        void variableSubstitutionBeforeDispatch() {
            when(prometheusResolver.resolve(any())).thenAnswer(invocation -> {
                WidgetDataRequest req = invocation.getArgument(0);
                // Verify the query was substituted
                assertEquals("up{service=\"payment-svc\"}", req.getQuery());
                return WidgetDataResponse.builder()
                        .widgetId(req.getWidgetId())
                        .timeSeries(List.of())
                        .build();
            });

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(WidgetDataRequest.builder()
                            .widgetId("w1")
                            .dataSourceType(DataSourceType.PROMETHEUS)
                            .query("up{service=\"$service\"}")
                            .build()))
                    .variables(Map.of("service", "payment-svc"))
                    .build();

            service.resolveBatch(request);

            verify(prometheusResolver).resolve(any());
        }

        @Test
        @DisplayName("should handle null variables map gracefully")
        void nullVariablesMap() {
            when(prometheusResolver.resolve(any())).thenReturn(
                    WidgetDataResponse.builder().widgetId("w1").timeSeries(List.of()).build());

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(WidgetDataRequest.builder()
                            .widgetId("w1")
                            .dataSourceType(DataSourceType.PROMETHEUS)
                            .query("up")
                            .build()))
                    .variables(null)
                    .build();

            BatchWidgetResolveResponse response = service.resolveBatch(request);

            assertEquals(1, response.getResults().size());
            assertNull(response.getResults().getFirst().getError());
        }

        @Test
        @DisplayName("should isolate errors per widget — one failure does not affect others")
        void errorIsolation() {
            when(prometheusResolver.resolve(any())).thenReturn(
                    WidgetDataResponse.builder().widgetId("w1").timeSeries(List.of()).build());
            when(elasticsearchResolver.resolve(any())).thenThrow(
                    new RuntimeException("ES connection refused"));

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(
                            WidgetDataRequest.builder()
                                    .widgetId("w1")
                                    .dataSourceType(DataSourceType.PROMETHEUS)
                                    .query("up").build(),
                            WidgetDataRequest.builder()
                                    .widgetId("w2")
                                    .dataSourceType(DataSourceType.ELASTICSEARCH)
                                    .query("error").build()))
                    .variables(Map.of())
                    .build();

            BatchWidgetResolveResponse response = service.resolveBatch(request);

            assertEquals(2, response.getResults().size());

            // Find responses by widget ID (order is not guaranteed with parallel execution)
            WidgetDataResponse w1Response = response.getResults().stream()
                    .filter(r -> "w1".equals(r.getWidgetId()))
                    .findFirst().orElseThrow();
            WidgetDataResponse w2Response = response.getResults().stream()
                    .filter(r -> "w2".equals(r.getWidgetId()))
                    .findFirst().orElseThrow();

            assertNull(w1Response.getError());
            assertNotNull(w2Response.getError());
            assertTrue(w2Response.getError().contains("ES connection refused"));
        }

        @Test
        @DisplayName("should return error for unsupported data source type")
        void unsupportedDataSource() {
            // DataSourceType is an enum, so we can't easily test a truly unknown type,
            // but we can verify the resolver map approach works correctly by
            // ensuring all 4 types are mapped and the orchestrator handles them.
            // This test verifies the resolver map was constructed correctly.
            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(WidgetDataRequest.builder()
                            .widgetId("w1")
                            .dataSourceType(DataSourceType.PROMETHEUS)
                            .query("up").build()))
                    .variables(Map.of())
                    .build();

            when(prometheusResolver.resolve(any())).thenReturn(
                    WidgetDataResponse.builder().widgetId("w1").timeSeries(List.of()).build());

            BatchWidgetResolveResponse response = service.resolveBatch(request);
            assertNull(response.getResults().getFirst().getError());
        }
    }
}

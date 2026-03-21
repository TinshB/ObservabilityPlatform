package com.observability.apm.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.observability.apm.dto.*;
import com.observability.apm.service.TemplateVariableService;
import com.observability.apm.service.WidgetResolverService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller tests for {@link WidgetDataController} (Stories 13.2 + 13.3).
 * Uses standalone MockMvc setup to avoid full application context loading.
 */
@ExtendWith(MockitoExtension.class)
class WidgetDataControllerTest {

    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule());

    @Mock
    private WidgetResolverService widgetResolverService;

    @Mock
    private TemplateVariableService templateVariableService;

    @InjectMocks
    private WidgetDataController widgetDataController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(widgetDataController).build();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // POST /api/v1/dashboards/widgets/resolve
    // ═══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("POST /api/v1/dashboards/widgets/resolve")
    class ResolveWidgets {

        @Test
        @DisplayName("should resolve a batch of widgets successfully")
        void resolveBatchSuccess() throws Exception {
            BatchWidgetResolveResponse batchResponse = BatchWidgetResolveResponse.builder()
                    .results(List.of(
                            WidgetDataResponse.builder()
                                    .widgetId("w1")
                                    .timeSeries(List.of(
                                            TimeSeries.builder()
                                                    .name("http_requests_total")
                                                    .labels(Map.of("service", "order-svc"))
                                                    .dataPoints(List.of(
                                                            new MetricDataPoint(1710720000L, 42.0)))
                                                    .build()))
                                    .build(),
                            WidgetDataResponse.builder()
                                    .widgetId("w2")
                                    .timeSeries(List.of())
                                    .rawData(Map.of("totalHits", 5))
                                    .build()))
                    .build();

            when(widgetResolverService.resolveBatch(any())).thenReturn(batchResponse);

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(
                            WidgetDataRequest.builder()
                                    .widgetId("w1")
                                    .dataSourceType(DataSourceType.PROMETHEUS)
                                    .query("http_requests_total{service=\"$service\"}")
                                    .start(Instant.parse("2026-03-18T00:00:00Z"))
                                    .end(Instant.parse("2026-03-18T01:00:00Z"))
                                    .stepSeconds(60)
                                    .build(),
                            WidgetDataRequest.builder()
                                    .widgetId("w2")
                                    .dataSourceType(DataSourceType.ELASTICSEARCH)
                                    .query("error")
                                    .start(Instant.parse("2026-03-18T00:00:00Z"))
                                    .end(Instant.parse("2026-03-18T01:00:00Z"))
                                    .build()))
                    .variables(Map.of("service", "order-svc"))
                    .build();

            mockMvc.perform(post("/api/v1/dashboards/widgets/resolve")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.results").isArray())
                    .andExpect(jsonPath("$.data.results.length()").value(2))
                    .andExpect(jsonPath("$.data.results[0].widgetId").value("w1"))
                    .andExpect(jsonPath("$.data.results[0].timeSeries[0].name").value("http_requests_total"))
                    .andExpect(jsonPath("$.data.results[1].widgetId").value("w2"));

            verify(widgetResolverService).resolveBatch(any());
        }

        @Test
        @DisplayName("should return widget with error field when resolver encounters an issue")
        void resolveWithErrors() throws Exception {
            BatchWidgetResolveResponse batchResponse = BatchWidgetResolveResponse.builder()
                    .results(List.of(
                            WidgetDataResponse.builder()
                                    .widgetId("w1")
                                    .timeSeries(List.of())
                                    .error("Prometheus query failed: timeout")
                                    .build()))
                    .build();

            when(widgetResolverService.resolveBatch(any())).thenReturn(batchResponse);

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of(WidgetDataRequest.builder()
                            .widgetId("w1")
                            .dataSourceType(DataSourceType.PROMETHEUS)
                            .query("bad_query")
                            .build()))
                    .variables(Map.of())
                    .build();

            mockMvc.perform(post("/api/v1/dashboards/widgets/resolve")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.results[0].error").value("Prometheus query failed: timeout"));
        }

        @Test
        @DisplayName("should accept request with empty widgets list")
        void emptyWidgetsList() throws Exception {
            BatchWidgetResolveResponse batchResponse = BatchWidgetResolveResponse.builder()
                    .results(List.of())
                    .build();

            when(widgetResolverService.resolveBatch(any())).thenReturn(batchResponse);

            BatchWidgetResolveRequest request = BatchWidgetResolveRequest.builder()
                    .widgets(List.of())
                    .variables(Map.of())
                    .build();

            mockMvc.perform(post("/api/v1/dashboards/widgets/resolve")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.results").isEmpty());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GET /api/v1/dashboards/variables/options
    // ═══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("GET /api/v1/dashboards/variables/options")
    class GetVariableOptions {

        @Test
        @DisplayName("should return service options for SERVICE type")
        void serviceOptions() throws Exception {
            TemplateVariableOptionsResponse optionsResponse = TemplateVariableOptionsResponse.builder()
                    .type("SERVICE")
                    .options(List.of(
                            VariableOption.builder().value("order-svc").label("order-svc").build(),
                            VariableOption.builder().value("payment-svc").label("payment-svc").build()))
                    .build();

            when(templateVariableService.getOptions("SERVICE")).thenReturn(optionsResponse);

            mockMvc.perform(get("/api/v1/dashboards/variables/options")
                            .param("type", "SERVICE"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.success").value(true))
                    .andExpect(jsonPath("$.data.type").value("SERVICE"))
                    .andExpect(jsonPath("$.data.options").isArray())
                    .andExpect(jsonPath("$.data.options.length()").value(2))
                    .andExpect(jsonPath("$.data.options[0].value").value("order-svc"))
                    .andExpect(jsonPath("$.data.options[0].label").value("order-svc"));

            verify(templateVariableService).getOptions("SERVICE");
        }

        @Test
        @DisplayName("should return environment options for ENVIRONMENT type")
        void environmentOptions() throws Exception {
            TemplateVariableOptionsResponse optionsResponse = TemplateVariableOptionsResponse.builder()
                    .type("ENVIRONMENT")
                    .options(List.of(
                            VariableOption.builder().value("production").label("production").build(),
                            VariableOption.builder().value("staging").label("staging").build()))
                    .build();

            when(templateVariableService.getOptions("ENVIRONMENT")).thenReturn(optionsResponse);

            mockMvc.perform(get("/api/v1/dashboards/variables/options")
                            .param("type", "ENVIRONMENT"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.type").value("ENVIRONMENT"))
                    .andExpect(jsonPath("$.data.options.length()").value(2));
        }

        @Test
        @DisplayName("should return time range presets for TIME_RANGE type")
        void timeRangeOptions() throws Exception {
            TemplateVariableOptionsResponse optionsResponse = TemplateVariableOptionsResponse.builder()
                    .type("TIME_RANGE")
                    .options(List.of(
                            VariableOption.builder().value("5m").label("Last 5 minutes").build(),
                            VariableOption.builder().value("1h").label("Last 1 hour").build()))
                    .build();

            when(templateVariableService.getOptions("TIME_RANGE")).thenReturn(optionsResponse);

            mockMvc.perform(get("/api/v1/dashboards/variables/options")
                            .param("type", "TIME_RANGE"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.type").value("TIME_RANGE"))
                    .andExpect(jsonPath("$.data.options[0].value").value("5m"))
                    .andExpect(jsonPath("$.data.options[0].label").value("Last 5 minutes"));
        }

        @Test
        @DisplayName("should return empty options for unknown type")
        void unknownType() throws Exception {
            TemplateVariableOptionsResponse optionsResponse = TemplateVariableOptionsResponse.builder()
                    .type("UNKNOWN")
                    .options(List.of())
                    .build();

            when(templateVariableService.getOptions("UNKNOWN")).thenReturn(optionsResponse);

            mockMvc.perform(get("/api/v1/dashboards/variables/options")
                            .param("type", "UNKNOWN"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.options").isEmpty());
        }
    }
}

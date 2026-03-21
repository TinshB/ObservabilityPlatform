package com.observability.apm.service;

import com.observability.apm.dto.DataSourceType;
import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;
import com.observability.apm.prometheus.PrometheusClient;
import com.observability.apm.prometheus.PrometheusResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link PrometheusWidgetResolver} (Story 13.2).
 */
@ExtendWith(MockitoExtension.class)
class PrometheusWidgetResolverTest {

    @Mock
    private PrometheusClient prometheusClient;

    @InjectMocks
    private PrometheusWidgetResolver resolver;

    @Test
    @DisplayName("should execute range query when start and end are provided")
    void rangeQuery() {
        Instant start = Instant.parse("2026-03-18T00:00:00Z");
        Instant end = Instant.parse("2026-03-18T01:00:00Z");

        PrometheusResponse promResponse = buildRangeResponse(
                Map.of("__name__", "http_requests_total", "service", "order-svc"),
                List.of(
                        List.of(1710720000L, "42.0"),
                        List.of(1710720060L, "45.0")
                ));

        when(prometheusClient.queryRange(eq("up"), eq(start), eq(end), eq(60L)))
                .thenReturn(promResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.PROMETHEUS)
                .query("up")
                .start(start)
                .end(end)
                .stepSeconds(60)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNull(response.getError());
        assertEquals(1, response.getTimeSeries().size());
        assertEquals("http_requests_total", response.getTimeSeries().getFirst().getName());
        assertEquals(2, response.getTimeSeries().getFirst().getDataPoints().size());
        assertEquals(42.0, response.getTimeSeries().getFirst().getDataPoints().get(0).getValue());

        verify(prometheusClient).queryRange("up", start, end, 60L);
        verify(prometheusClient, never()).query(anyString());
    }

    @Test
    @DisplayName("should default step to 60 seconds when stepSeconds is 0")
    void defaultStep() {
        Instant start = Instant.parse("2026-03-18T00:00:00Z");
        Instant end = Instant.parse("2026-03-18T01:00:00Z");

        when(prometheusClient.queryRange(eq("up"), eq(start), eq(end), eq(60L)))
                .thenReturn(emptyPrometheusResponse());

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.PROMETHEUS)
                .query("up")
                .start(start)
                .end(end)
                .stepSeconds(0)
                .build();

        resolver.resolve(request);

        verify(prometheusClient).queryRange("up", start, end, 60L);
    }

    @Test
    @DisplayName("should execute instant query when start/end are not provided")
    void instantQuery() {
        PrometheusResponse promResponse = buildInstantResponse(
                Map.of("__name__", "up"),
                List.of(1710720000L, "1.0"));

        when(prometheusClient.query("up")).thenReturn(promResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.PROMETHEUS)
                .query("up")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNull(response.getError());
        assertEquals(1, response.getTimeSeries().size());
        assertEquals(1, response.getTimeSeries().getFirst().getDataPoints().size());
        assertEquals(1.0, response.getTimeSeries().getFirst().getDataPoints().getFirst().getValue());

        verify(prometheusClient).query("up");
        verify(prometheusClient, never()).queryRange(anyString(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("should return empty time series for null response")
    void nullResponse() {
        when(prometheusClient.query("up")).thenReturn(null);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("up")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNull(response.getError());
        assertTrue(response.getTimeSeries().isEmpty());
    }

    @Test
    @DisplayName("should return empty time series for response with null data")
    void nullDataInResponse() {
        PrometheusResponse promResponse = new PrometheusResponse();
        promResponse.setStatus("success");
        promResponse.setData(null);

        when(prometheusClient.query("up")).thenReturn(promResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("up")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertTrue(response.getTimeSeries().isEmpty());
        assertNull(response.getError());
    }

    @Test
    @DisplayName("should return error response when Prometheus client throws exception")
    void clientException() {
        when(prometheusClient.query("bad_query"))
                .thenThrow(new RuntimeException("Connection refused"));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("bad_query")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNotNull(response.getError());
        assertTrue(response.getError().contains("Connection refused"));
        assertTrue(response.getTimeSeries().isEmpty());
    }

    @Test
    @DisplayName("should skip NaN values from Prometheus response")
    void nanValues() {
        PrometheusResponse promResponse = buildRangeResponse(
                Map.of("__name__", "metric"),
                List.of(
                        List.of(1710720000L, "42.0"),
                        List.of(1710720060L, "NaN"),
                        List.of(1710720120L, "50.0")
                ));

        Instant start = Instant.parse("2026-03-18T00:00:00Z");
        Instant end = Instant.parse("2026-03-18T01:00:00Z");
        when(prometheusClient.queryRange(anyString(), any(), any(), anyLong()))
                .thenReturn(promResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("metric")
                .start(start)
                .end(end)
                .stepSeconds(60)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        // NaN value should be filtered out, leaving 2 data points
        assertEquals(2, response.getTimeSeries().getFirst().getDataPoints().size());
    }

    @Test
    @DisplayName("should handle multiple result series from Prometheus")
    void multipleResultSeries() {
        PrometheusResponse promResponse = new PrometheusResponse();
        promResponse.setStatus("success");
        PrometheusResponse.PromData data = new PrometheusResponse.PromData();
        data.setResultType("matrix");

        PrometheusResponse.PromResult r1 = new PrometheusResponse.PromResult();
        r1.setMetric(Map.of("__name__", "up", "instance", "host1:9090"));
        r1.setValues(List.of(List.of(1710720000L, "1.0")));

        PrometheusResponse.PromResult r2 = new PrometheusResponse.PromResult();
        r2.setMetric(Map.of("__name__", "up", "instance", "host2:9090"));
        r2.setValues(List.of(List.of(1710720000L, "0.0")));

        data.setResult(List.of(r1, r2));
        promResponse.setData(data);

        Instant start = Instant.parse("2026-03-18T00:00:00Z");
        Instant end = Instant.parse("2026-03-18T01:00:00Z");
        when(prometheusClient.queryRange(anyString(), any(), any(), anyLong()))
                .thenReturn(promResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("up")
                .start(start)
                .end(end)
                .stepSeconds(60)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals(2, response.getTimeSeries().size());
        assertEquals("host1:9090", response.getTimeSeries().get(0).getLabels().get("instance"));
        assertEquals("host2:9090", response.getTimeSeries().get(1).getLabels().get("instance"));
    }

    @Test
    @DisplayName("should use 'series' as fallback name when __name__ label is absent")
    void fallbackSeriesName() {
        PrometheusResponse promResponse = buildInstantResponse(
                Map.of("job", "prometheus"),
                List.of(1710720000L, "1.0"));

        when(prometheusClient.query("up")).thenReturn(promResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("up")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("series", response.getTimeSeries().getFirst().getName());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private PrometheusResponse buildRangeResponse(Map<String, String> metric,
                                                   List<List<Object>> values) {
        PrometheusResponse response = new PrometheusResponse();
        response.setStatus("success");
        PrometheusResponse.PromData data = new PrometheusResponse.PromData();
        data.setResultType("matrix");
        PrometheusResponse.PromResult result = new PrometheusResponse.PromResult();
        result.setMetric(metric);
        result.setValues(values);
        data.setResult(List.of(result));
        response.setData(data);
        return response;
    }

    private PrometheusResponse buildInstantResponse(Map<String, String> metric,
                                                     List<Object> value) {
        PrometheusResponse response = new PrometheusResponse();
        response.setStatus("success");
        PrometheusResponse.PromData data = new PrometheusResponse.PromData();
        data.setResultType("vector");
        PrometheusResponse.PromResult result = new PrometheusResponse.PromResult();
        result.setMetric(metric);
        result.setValue(value);
        data.setResult(List.of(result));
        response.setData(data);
        return response;
    }

    private PrometheusResponse emptyPrometheusResponse() {
        PrometheusResponse response = new PrometheusResponse();
        response.setStatus("success");
        PrometheusResponse.PromData data = new PrometheusResponse.PromData();
        data.setResultType("matrix");
        data.setResult(List.of());
        response.setData(data);
        return response;
    }
}

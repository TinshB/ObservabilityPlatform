package com.observability.apm.service;

import com.observability.apm.dto.DataSourceType;
import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;
import com.observability.apm.jaeger.JaegerClient;
import com.observability.apm.jaeger.JaegerResponse;
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
 * Unit tests for {@link JaegerWidgetResolver} (Story 13.2).
 */
@ExtendWith(MockitoExtension.class)
class JaegerWidgetResolverTest {

    @Mock
    private JaegerClient jaegerClient;

    @InjectMocks
    private JaegerWidgetResolver resolver;

    private static final Instant START = Instant.parse("2026-03-18T00:00:00Z");
    private static final Instant END = Instant.parse("2026-03-18T01:00:00Z");

    @Test
    @DisplayName("should query Jaeger traces with service from query field")
    void queryWithServiceFromQuery() {
        JaegerResponse jaegerResponse = new JaegerResponse();
        jaegerResponse.setData(List.of());

        when(jaegerClient.getTraces(
                eq("order-svc"), isNull(), eq(START), eq(END),
                isNull(), isNull(), eq(20), isNull()))
                .thenReturn(jaegerResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.JAEGER)
                .query("order-svc")
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNull(response.getError());
        assertNotNull(response.getRawData());
        assertTrue(response.getTimeSeries().isEmpty());
    }

    @Test
    @DisplayName("should use service from params when present")
    void serviceFromParams() {
        JaegerResponse jaegerResponse = new JaegerResponse();
        jaegerResponse.setData(List.of());

        when(jaegerClient.getTraces(
                eq("payment-svc"), isNull(), eq(START), eq(END),
                isNull(), isNull(), eq(20), isNull()))
                .thenReturn(jaegerResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.JAEGER)
                .query("ignored-query")
                .params(Map.of("service", "payment-svc"))
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        verify(jaegerClient).getTraces(
                eq("payment-svc"), isNull(), any(), any(),
                isNull(), isNull(), eq(20), isNull());
    }

    @Test
    @DisplayName("should pass operation and duration filters from params")
    void operationAndDurationFilters() {
        JaegerResponse jaegerResponse = new JaegerResponse();
        jaegerResponse.setData(List.of());

        when(jaegerClient.getTraces(
                eq("api-svc"), eq("GET /api/v1/users"), eq(START), eq(END),
                eq("100ms"), eq("5s"), eq(10), isNull()))
                .thenReturn(jaegerResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.JAEGER)
                .query("api-svc")
                .params(Map.of(
                        "operation", "GET /api/v1/users",
                        "minDuration", "100ms",
                        "maxDuration", "5s",
                        "limit", "10"))
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        verify(jaegerClient).getTraces(
                eq("api-svc"), eq("GET /api/v1/users"), eq(START), eq(END),
                eq("100ms"), eq("5s"), eq(10), isNull());
    }

    @Test
    @DisplayName("should pass tags filter from params")
    void tagsFilter() {
        JaegerResponse jaegerResponse = new JaegerResponse();
        jaegerResponse.setData(List.of());

        String tagsJson = "{\"error\":\"true\"}";
        when(jaegerClient.getTraces(
                eq("svc"), isNull(), eq(START), eq(END),
                isNull(), isNull(), eq(20), eq(tagsJson)))
                .thenReturn(jaegerResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.JAEGER)
                .query("svc")
                .params(Map.of("tags", tagsJson))
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
    }

    @Test
    @DisplayName("should handle null params map")
    void nullParams() {
        JaegerResponse jaegerResponse = new JaegerResponse();
        jaegerResponse.setData(List.of());

        when(jaegerClient.getTraces(
                eq("svc"), isNull(), eq(START), eq(END),
                isNull(), isNull(), eq(20), isNull()))
                .thenReturn(jaegerResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("svc")
                .params(null)
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
    }

    @Test
    @DisplayName("should fallback to default limit for invalid limit param")
    void invalidLimitParam() {
        JaegerResponse jaegerResponse = new JaegerResponse();
        jaegerResponse.setData(List.of());

        when(jaegerClient.getTraces(
                eq("svc"), isNull(), eq(START), eq(END),
                isNull(), isNull(), eq(20), isNull()))
                .thenReturn(jaegerResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("svc")
                .params(Map.of("limit", "not-a-number"))
                .start(START)
                .end(END)
                .build();

        resolver.resolve(request);

        verify(jaegerClient).getTraces(
                eq("svc"), isNull(), eq(START), eq(END),
                isNull(), isNull(), eq(20), isNull());
    }

    @Test
    @DisplayName("should return error response when Jaeger client throws")
    void clientException() {
        when(jaegerClient.getTraces(
                anyString(), any(), any(), any(),
                any(), any(), anyInt(), any()))
                .thenThrow(new RuntimeException("Jaeger unavailable"));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("svc")
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNotNull(response.getError());
        assertTrue(response.getError().contains("Jaeger unavailable"));
        assertTrue(response.getTimeSeries().isEmpty());
    }

    @Test
    @DisplayName("should return Jaeger response data as rawData")
    void rawDataContainsJaegerTraces() {
        JaegerResponse jaegerResponse = new JaegerResponse();
        JaegerResponse.JaegerTrace trace = new JaegerResponse.JaegerTrace();
        trace.setTraceId("abc123");
        trace.setSpans(List.of());
        jaegerResponse.setData(List.of(trace));

        when(jaegerClient.getTraces(
                anyString(), any(), any(), any(),
                any(), any(), anyInt(), any()))
                .thenReturn(jaegerResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("svc")
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNotNull(response.getRawData());
        assertInstanceOf(JaegerResponse.class, response.getRawData());
        JaegerResponse returned = (JaegerResponse) response.getRawData();
        assertEquals(1, returned.getData().size());
        assertEquals("abc123", returned.getData().getFirst().getTraceId());
    }
}

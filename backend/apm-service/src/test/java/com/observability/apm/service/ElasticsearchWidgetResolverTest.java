package com.observability.apm.service;

import com.observability.apm.dto.DataSourceType;
import com.observability.apm.dto.LogSearchResponse;
import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;
import com.observability.apm.elasticsearch.ElasticsearchLogClient;
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
 * Unit tests for {@link ElasticsearchWidgetResolver} (Story 13.2).
 */
@ExtendWith(MockitoExtension.class)
class ElasticsearchWidgetResolverTest {

    @Mock
    private ElasticsearchLogClient elasticsearchLogClient;

    @InjectMocks
    private ElasticsearchWidgetResolver resolver;

    private static final Instant START = Instant.parse("2026-03-18T00:00:00Z");
    private static final Instant END = Instant.parse("2026-03-18T01:00:00Z");

    @Test
    @DisplayName("should search logs with service name and severity filters")
    void searchWithFilters() {
        LogSearchResponse logResponse = LogSearchResponse.builder()
                .totalHits(5)
                .page(0)
                .size(100)
                .totalPages(1)
                .entries(List.of(LogSearchResponse.LogEntry.builder()
                        .severity("ERROR")
                        .serviceName("order-svc")
                        .body("NullPointerException")
                        .build()))
                .build();

        when(elasticsearchLogClient.searchLogs(
                eq("order-svc"), eq(List.of("ERROR")), eq("NullPointer"),
                isNull(), eq(START), eq(END), eq(0), eq(100)))
                .thenReturn(logResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.ELASTICSEARCH)
                .query("NullPointer")
                .params(Map.of("serviceName", "order-svc", "severity", "ERROR"))
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
    @DisplayName("should search logs without optional params")
    void searchWithoutOptionalParams() {
        LogSearchResponse logResponse = LogSearchResponse.builder()
                .totalHits(0)
                .page(0)
                .size(100)
                .totalPages(0)
                .entries(List.of())
                .build();

        when(elasticsearchLogClient.searchLogs(
                isNull(), isNull(), eq("search text"),
                isNull(), eq(START), eq(END), eq(0), eq(100)))
                .thenReturn(logResponse);

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.ELASTICSEARCH)
                .query("search text")
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        assertNotNull(response.getRawData());
    }

    @Test
    @DisplayName("should handle null params map")
    void nullParams() {
        when(elasticsearchLogClient.searchLogs(
                isNull(), isNull(), eq("test"),
                isNull(), eq(START), eq(END), eq(0), eq(100)))
                .thenReturn(LogSearchResponse.builder()
                        .totalHits(0).page(0).size(100).totalPages(0)
                        .entries(List.of()).build());

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("test")
                .params(null)
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
    }

    @Test
    @DisplayName("should use custom size from params")
    void customSize() {
        when(elasticsearchLogClient.searchLogs(
                isNull(), isNull(), eq("test"),
                isNull(), eq(START), eq(END), eq(0), eq(50)))
                .thenReturn(LogSearchResponse.builder()
                        .totalHits(0).page(0).size(50).totalPages(0)
                        .entries(List.of()).build());

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("test")
                .params(Map.of("size", "50"))
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        verify(elasticsearchLogClient).searchLogs(
                isNull(), isNull(), eq("test"),
                isNull(), eq(START), eq(END), eq(0), eq(50));
    }

    @Test
    @DisplayName("should filter by traceId from params")
    void traceIdFilter() {
        when(elasticsearchLogClient.searchLogs(
                isNull(), isNull(), eq("test"),
                eq("abc123"), eq(START), eq(END), eq(0), eq(100)))
                .thenReturn(LogSearchResponse.builder()
                        .totalHits(1).page(0).size(100).totalPages(1)
                        .entries(List.of()).build());

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("test")
                .params(Map.of("traceId", "abc123"))
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        verify(elasticsearchLogClient).searchLogs(
                isNull(), isNull(), eq("test"),
                eq("abc123"), eq(START), eq(END), eq(0), eq(100));
    }

    @Test
    @DisplayName("should handle comma-separated severity values")
    void multipleSeverities() {
        when(elasticsearchLogClient.searchLogs(
                isNull(), eq(List.of("ERROR", "FATAL")), eq("test"),
                isNull(), eq(START), eq(END), eq(0), eq(100)))
                .thenReturn(LogSearchResponse.builder()
                        .totalHits(0).page(0).size(100).totalPages(0)
                        .entries(List.of()).build());

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("test")
                .params(Map.of("severity", "ERROR,FATAL"))
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
    }

    @Test
    @DisplayName("should return error response when Elasticsearch client throws")
    void clientException() {
        when(elasticsearchLogClient.searchLogs(
                any(), any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenThrow(new RuntimeException("ES cluster unavailable"));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("test")
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNotNull(response.getError());
        assertTrue(response.getError().contains("ES cluster unavailable"));
        assertTrue(response.getTimeSeries().isEmpty());
    }

    @Test
    @DisplayName("should fallback to default size for non-numeric size param")
    void invalidSizeParam() {
        when(elasticsearchLogClient.searchLogs(
                isNull(), isNull(), eq("test"),
                isNull(), eq(START), eq(END), eq(0), eq(100)))
                .thenReturn(LogSearchResponse.builder()
                        .totalHits(0).page(0).size(100).totalPages(0)
                        .entries(List.of()).build());

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .query("test")
                .params(Map.of("size", "invalid"))
                .start(START)
                .end(END)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        verify(elasticsearchLogClient).searchLogs(
                isNull(), isNull(), eq("test"),
                isNull(), eq(START), eq(END), eq(0), eq(100));
    }
}

package com.observability.apm.service;

import com.observability.apm.dto.DataSourceType;
import com.observability.apm.dto.WidgetDataRequest;
import com.observability.apm.dto.WidgetDataResponse;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.AlertRepository;
import com.observability.apm.repository.ServiceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link PostgresWidgetResolver} (Story 13.2).
 */
@ExtendWith(MockitoExtension.class)
class PostgresWidgetResolverTest {

    @Mock
    private ServiceRepository serviceRepository;

    @Mock
    private AlertRepository alertRepository;

    @InjectMocks
    private PostgresWidgetResolver resolver;

    @Test
    @DisplayName("should query services with filters")
    void queryServices() {
        ServiceEntity svc = ServiceEntity.builder()
                .id(UUID.randomUUID())
                .name("order-svc")
                .environment("production")
                .build();

        when(serviceRepository.findWithFilters(
                isNull(), isNull(), isNull(), isNull(), eq(true), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(svc)));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("services")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNull(response.getError());
        assertNotNull(response.getRawData());
        assertTrue(response.getTimeSeries().isEmpty());
    }

    @Test
    @DisplayName("should query services with search and environment filters from params")
    void queryServicesWithFilters() {
        when(serviceRepository.findWithFilters(
                eq("order"), eq("production"), isNull(), isNull(), eq(true), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("services")
                .params(Map.of("entity", "services", "search", "order", "environment", "production"))
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        verify(serviceRepository).findWithFilters(
                eq("order"), eq("production"), isNull(), isNull(), eq(true), any(PageRequest.class));
    }

    @Test
    @DisplayName("should query service names")
    void queryServiceNames() {
        ServiceEntity svc1 = ServiceEntity.builder().name("order-svc").build();
        ServiceEntity svc2 = ServiceEntity.builder().name("payment-svc").build();

        when(serviceRepository.findAll()).thenReturn(List.of(svc1, svc2));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("service_names")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        assertNotNull(response.getRawData());
        @SuppressWarnings("unchecked")
        List<String> names = (List<String>) response.getRawData();
        assertEquals(2, names.size());
        assertTrue(names.contains("order-svc"));
        assertTrue(names.contains("payment-svc"));
    }

    @Test
    @DisplayName("should query distinct environments")
    void queryEnvironments() {
        when(serviceRepository.findDistinctEnvironments())
                .thenReturn(List.of("production", "staging", "development"));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("environments")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        @SuppressWarnings("unchecked")
        List<String> envs = (List<String>) response.getRawData();
        assertEquals(3, envs.size());
        assertTrue(envs.contains("production"));
    }

    @Test
    @DisplayName("should query alerts with custom page size")
    void queryAlerts() {
        when(alertRepository.findAll(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("alerts")
                .params(Map.of("size", "10"))
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        verify(alertRepository).findAll(PageRequest.of(0, 10));
    }

    @Test
    @DisplayName("should return error map for unknown entity")
    void unknownEntity() {
        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("unknown_entity")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        assertNotNull(response.getRawData());
        @SuppressWarnings("unchecked")
        Map<String, String> errorMap = (Map<String, String>) response.getRawData();
        assertTrue(errorMap.get("error").contains("Unknown PostgreSQL entity"));
    }

    @Test
    @DisplayName("should use entity param over query field")
    void entityFromParams() {
        when(serviceRepository.findDistinctEnvironments())
                .thenReturn(List.of("prod"));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("services") // would resolve to services
                .params(Map.of("entity", "environments")) // but entity param overrides
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
        verify(serviceRepository).findDistinctEnvironments();
        verify(serviceRepository, never()).findWithFilters(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("should handle null params gracefully")
    void nullParams() {
        when(serviceRepository.findWithFilters(
                isNull(), isNull(), isNull(), isNull(), eq(true), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("services")
                .params(null)
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertNull(response.getError());
    }

    @Test
    @DisplayName("should return error response when repository throws")
    void repositoryException() {
        when(serviceRepository.findAll())
                .thenThrow(new RuntimeException("DB connection lost"));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("service_names")
                .build();

        WidgetDataResponse response = resolver.resolve(request);

        assertEquals("w1", response.getWidgetId());
        assertNotNull(response.getError());
        assertTrue(response.getError().contains("DB connection lost"));
        assertTrue(response.getTimeSeries().isEmpty());
    }

    @Test
    @DisplayName("should default to 50 results when size param is absent")
    void defaultSize() {
        when(serviceRepository.findWithFilters(
                isNull(), isNull(), isNull(), isNull(), eq(true), eq(PageRequest.of(0, 50))))
                .thenReturn(new PageImpl<>(List.of()));

        WidgetDataRequest request = WidgetDataRequest.builder()
                .widgetId("w1")
                .dataSourceType(DataSourceType.POSTGRESQL)
                .query("services")
                .build();

        resolver.resolve(request);

        verify(serviceRepository).findWithFilters(
                isNull(), isNull(), isNull(), isNull(), eq(true), eq(PageRequest.of(0, 50)));
    }
}

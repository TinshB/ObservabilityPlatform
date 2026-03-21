package com.observability.apm.service;

import com.observability.apm.dto.TemplateVariableOptionsResponse;
import com.observability.apm.entity.ServiceEntity;
import com.observability.apm.repository.ServiceRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TemplateVariableService} (Story 13.3).
 */
@ExtendWith(MockitoExtension.class)
class TemplateVariableServiceTest {

    @Mock
    private ServiceRepository serviceRepository;

    @InjectMocks
    private TemplateVariableService templateVariableService;

    @Test
    @DisplayName("should return service names for SERVICE variable type")
    void serviceVariableType() {
        when(serviceRepository.findAll()).thenReturn(List.of(
                ServiceEntity.builder().name("order-svc").build(),
                ServiceEntity.builder().name("payment-svc").build(),
                ServiceEntity.builder().name("user-svc").build()
        ));

        TemplateVariableOptionsResponse response = templateVariableService.getOptions("SERVICE");

        assertEquals("SERVICE", response.getType());
        assertEquals(3, response.getOptions().size());
        assertEquals("order-svc", response.getOptions().get(0).getValue());
        assertEquals("order-svc", response.getOptions().get(0).getLabel());
        assertEquals("payment-svc", response.getOptions().get(1).getValue());
        assertEquals("user-svc", response.getOptions().get(2).getValue());

        verify(serviceRepository).findAll();
    }

    @Test
    @DisplayName("should return distinct environments for ENVIRONMENT variable type")
    void environmentVariableType() {
        when(serviceRepository.findDistinctEnvironments())
                .thenReturn(List.of("development", "production", "staging"));

        TemplateVariableOptionsResponse response = templateVariableService.getOptions("ENVIRONMENT");

        assertEquals("ENVIRONMENT", response.getType());
        assertEquals(3, response.getOptions().size());
        assertEquals("development", response.getOptions().get(0).getValue());
        assertEquals("development", response.getOptions().get(0).getLabel());
        assertEquals("production", response.getOptions().get(1).getValue());
        assertEquals("staging", response.getOptions().get(2).getValue());

        verify(serviceRepository).findDistinctEnvironments();
    }

    @Test
    @DisplayName("should return static time range presets for TIME_RANGE variable type")
    void timeRangeVariableType() {
        TemplateVariableOptionsResponse response = templateVariableService.getOptions("TIME_RANGE");

        assertEquals("TIME_RANGE", response.getType());
        assertEquals(10, response.getOptions().size());

        // Verify first and last entries
        assertEquals("5m", response.getOptions().get(0).getValue());
        assertEquals("Last 5 minutes", response.getOptions().get(0).getLabel());
        assertEquals("30d", response.getOptions().get(9).getValue());
        assertEquals("Last 30 days", response.getOptions().get(9).getLabel());

        // Verify middle entries
        assertEquals("1h", response.getOptions().get(3).getValue());
        assertEquals("Last 1 hour", response.getOptions().get(3).getLabel());

        // No repository calls for static presets
        verifyNoInteractions(serviceRepository);
    }

    @Test
    @DisplayName("should return empty options for unknown variable type")
    void unknownVariableType() {
        TemplateVariableOptionsResponse response = templateVariableService.getOptions("UNKNOWN_TYPE");

        assertEquals("UNKNOWN_TYPE", response.getType());
        assertTrue(response.getOptions().isEmpty());

        verifyNoInteractions(serviceRepository);
    }

    @Test
    @DisplayName("should handle case-insensitive variable type")
    void caseInsensitiveType() {
        when(serviceRepository.findAll()).thenReturn(List.of(
                ServiceEntity.builder().name("svc").build()));

        TemplateVariableOptionsResponse response = templateVariableService.getOptions("service");

        assertEquals("SERVICE", response.getType());
        assertEquals(1, response.getOptions().size());
    }

    @Test
    @DisplayName("should handle mixed case variable type")
    void mixedCaseType() {
        TemplateVariableOptionsResponse response = templateVariableService.getOptions("Time_Range");

        assertEquals("TIME_RANGE", response.getType());
        assertEquals(10, response.getOptions().size());
    }

    @Test
    @DisplayName("should return empty service list when no services exist")
    void emptyServiceList() {
        when(serviceRepository.findAll()).thenReturn(List.of());

        TemplateVariableOptionsResponse response = templateVariableService.getOptions("SERVICE");

        assertEquals("SERVICE", response.getType());
        assertTrue(response.getOptions().isEmpty());
    }

    @Test
    @DisplayName("should return empty environment list when no environments exist")
    void emptyEnvironmentList() {
        when(serviceRepository.findDistinctEnvironments()).thenReturn(List.of());

        TemplateVariableOptionsResponse response = templateVariableService.getOptions("ENVIRONMENT");

        assertEquals("ENVIRONMENT", response.getType());
        assertTrue(response.getOptions().isEmpty());
    }
}

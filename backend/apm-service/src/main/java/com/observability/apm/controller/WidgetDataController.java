package com.observability.apm.controller;

import com.observability.apm.dto.BatchWidgetResolveRequest;
import com.observability.apm.dto.BatchWidgetResolveResponse;
import com.observability.apm.dto.TemplateVariableOptionsResponse;
import com.observability.apm.service.TemplateVariableService;
import com.observability.apm.service.WidgetResolverService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Stories 13.2 + 13.3 — Widget data resolution and template variable options.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Dashboards", description = "Custom dashboards with JSONB widget configuration")
public class WidgetDataController {

    private final WidgetResolverService widgetResolverService;
    private final TemplateVariableService templateVariableService;

    @PostMapping("/api/v1/dashboards/widgets/resolve")
    @Operation(summary = "Batch resolve widget data from configured data sources")
    public ResponseEntity<ApiResponse<BatchWidgetResolveResponse>> resolveWidgets(
            @RequestBody BatchWidgetResolveRequest request) {
        BatchWidgetResolveResponse result = widgetResolverService.resolveBatch(request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/dashboards/variables/options")
    @Operation(summary = "Get available options for a template variable type")
    public ResponseEntity<ApiResponse<TemplateVariableOptionsResponse>> getVariableOptions(
            @RequestParam String type) {
        TemplateVariableOptionsResponse result = templateVariableService.getOptions(type);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}

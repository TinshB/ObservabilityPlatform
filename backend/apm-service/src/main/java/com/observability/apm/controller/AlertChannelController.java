package com.observability.apm.controller;

import com.observability.apm.dto.AlertChannelResponse;
import com.observability.apm.dto.CreateAlertChannelRequest;
import com.observability.apm.dto.UpdateAlertChannelRequest;
import com.observability.apm.service.AlertChannelService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * Story 10.6 — Alert channel configuration REST controller.
 * CRUD endpoints for EMAIL, SMS, and MS_TEAMS notification channels.
 */
@RestController
@RequiredArgsConstructor
@Tag(name = "Alert Channels", description = "Notification channel management — EMAIL, SMS, MS_TEAMS")
public class AlertChannelController {

    private final AlertChannelService alertChannelService;

    @PostMapping("/api/v1/alert-channels")
    @Operation(summary = "Create a notification channel")
    public ResponseEntity<ApiResponse<AlertChannelResponse>> createChannel(
            @Valid @RequestBody CreateAlertChannelRequest request) {
        AlertChannelResponse result = alertChannelService.createChannel(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/alert-channels")
    @Operation(summary = "List all notification channels")
    public ResponseEntity<ApiResponse<List<AlertChannelResponse>>> listChannels() {
        List<AlertChannelResponse> result = alertChannelService.listChannels();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/api/v1/alert-channels/{id}")
    @Operation(summary = "Get notification channel by ID")
    public ResponseEntity<ApiResponse<AlertChannelResponse>> getChannel(@PathVariable UUID id) {
        AlertChannelResponse result = alertChannelService.getChannel(id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PutMapping("/api/v1/alert-channels/{id}")
    @Operation(summary = "Update a notification channel")
    public ResponseEntity<ApiResponse<AlertChannelResponse>> updateChannel(
            @PathVariable UUID id,
            @RequestBody UpdateAlertChannelRequest request) {
        AlertChannelResponse result = alertChannelService.updateChannel(id, request);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @DeleteMapping("/api/v1/alert-channels/{id}")
    @Operation(summary = "Delete a notification channel")
    public ResponseEntity<Void> deleteChannel(@PathVariable UUID id) {
        alertChannelService.deleteChannel(id);
        return ResponseEntity.noContent().build();
    }
}

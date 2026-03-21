package com.observability.auth.controller;

import com.observability.auth.dto.AssignRolesRequest;
import com.observability.auth.dto.PermissionResponse;
import com.observability.auth.dto.RoleRequest;
import com.observability.auth.dto.RoleResponse;
import com.observability.auth.security.RequiresPermission;
import com.observability.auth.service.RoleService;
import com.observability.shared.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
@Tag(name = "Role Management", description = "CRUD operations for roles and permissions")
public class RoleController {

    private final RoleService roleService;

    @GetMapping
    @RequiresPermission(resource = "ROLES", action = "READ")
    @Operation(summary = "List roles", description = "Retrieve all roles with their permissions")
    public ResponseEntity<ApiResponse<List<RoleResponse>>> listRoles() {
        List<RoleResponse> roles = roleService.listRoles();
        return ResponseEntity.ok(ApiResponse.success(roles));
    }

    @GetMapping("/{id}")
    @RequiresPermission(resource = "ROLES", action = "READ")
    @Operation(summary = "Get role", description = "Retrieve a role by ID with its permissions")
    public ResponseEntity<ApiResponse<RoleResponse>> getRole(@PathVariable UUID id) {
        RoleResponse role = roleService.getRoleById(id);
        return ResponseEntity.ok(ApiResponse.success(role));
    }

    @PostMapping
    @RequiresPermission(resource = "ROLES", action = "CREATE")
    @Operation(summary = "Create role", description = "Create a custom role with permissions")
    public ResponseEntity<ApiResponse<RoleResponse>> createRole(
            @RequestBody @Valid RoleRequest request) {
        RoleResponse role = roleService.createRole(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(role));
    }

    @PutMapping("/{id}")
    @RequiresPermission(resource = "ROLES", action = "UPDATE")
    @Operation(summary = "Update role", description = "Update role name, description, and permissions")
    public ResponseEntity<ApiResponse<RoleResponse>> updateRole(
            @PathVariable UUID id,
            @RequestBody @Valid RoleRequest request) {
        RoleResponse role = roleService.updateRole(id, request);
        return ResponseEntity.ok(ApiResponse.success(role, "Role updated successfully"));
    }

    @PutMapping("/{id}/permissions")
    @RequiresPermission(resource = "ROLES", action = "UPDATE")
    @Operation(summary = "Update role permissions", description = "Replace a role's permission set")
    public ResponseEntity<ApiResponse<RoleResponse>> updatePermissions(
            @PathVariable UUID id,
            @RequestBody @Valid AssignRolesRequest request) {
        RoleResponse role = roleService.updatePermissions(id, request.getRoleIds());
        return ResponseEntity.ok(ApiResponse.success(role, "Permissions updated successfully"));
    }

    @GetMapping("/permissions")
    @RequiresPermission(resource = "ROLES", action = "READ")
    @Operation(summary = "List permissions", description = "Retrieve all available permissions")
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> listPermissions() {
        List<PermissionResponse> permissions = roleService.listPermissions();
        return ResponseEntity.ok(ApiResponse.success(permissions));
    }
}

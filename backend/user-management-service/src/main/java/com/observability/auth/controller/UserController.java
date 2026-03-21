package com.observability.auth.controller;

import com.observability.auth.dto.AssignRolesRequest;
import com.observability.auth.dto.ChangePasswordRequest;
import com.observability.auth.dto.CreateUserRequest;
import com.observability.auth.dto.UpdateUserRequest;
import com.observability.auth.dto.UserResponse;
import com.observability.auth.security.RequiresPermission;
import com.observability.auth.service.UserService;
import com.observability.shared.dto.ApiResponse;
import com.observability.shared.dto.PagedResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Management", description = "CRUD operations for users")
public class UserController {

    private final UserService userService;

    @GetMapping
    @RequiresPermission(resource = "USERS", action = "READ")
    @Operation(summary = "List users", description = "Retrieve a paginated list of all users")
    public ResponseEntity<ApiResponse<PagedResponse<UserResponse>>> listUsers(
            @PageableDefault(size = 20) Pageable pageable) {
        Page<UserResponse> page = userService.listUsers(pageable);
        return ResponseEntity.ok(ApiResponse.success(PagedResponse.from(page)));
    }

    @GetMapping("/{id}")
    @RequiresPermission(resource = "USERS", action = "READ")
    @Operation(summary = "Get user", description = "Retrieve a user by ID")
    public ResponseEntity<ApiResponse<UserResponse>> getUser(@PathVariable UUID id) {
        UserResponse user = userService.getUserById(id);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PostMapping
    @RequiresPermission(resource = "USERS", action = "CREATE")
    @Operation(summary = "Create user", description = "Create a new user with role assignment")
    public ResponseEntity<ApiResponse<UserResponse>> createUser(
            @RequestBody @Valid CreateUserRequest request) {
        UserResponse user = userService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(user));
    }

    @PutMapping("/{id}")
    @RequiresPermission(resource = "USERS", action = "UPDATE")
    @Operation(summary = "Update user", description = "Update user email or active status")
    public ResponseEntity<ApiResponse<UserResponse>> updateUser(
            @PathVariable UUID id,
            @RequestBody @Valid UpdateUserRequest request) {
        UserResponse user = userService.updateUser(id, request);
        return ResponseEntity.ok(ApiResponse.success(user, "User updated successfully"));
    }

    @DeleteMapping("/{id}")
    @RequiresPermission(resource = "USERS", action = "DELETE")
    @Operation(summary = "Deactivate user", description = "Soft-delete a user by setting active to false")
    public ResponseEntity<ApiResponse<Void>> deactivateUser(@PathVariable UUID id) {
        userService.deactivateUser(id);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @PutMapping("/{id}/roles")
    @RequiresPermission(resource = "USERS", action = "UPDATE")
    @Operation(summary = "Assign roles", description = "Replace a user's role set")
    public ResponseEntity<ApiResponse<UserResponse>> assignRoles(
            @PathVariable UUID id,
            @RequestBody @Valid AssignRolesRequest request) {
        UserResponse user = userService.assignRoles(id, request.getRoleIds());
        return ResponseEntity.ok(ApiResponse.success(user, "Roles assigned successfully"));
    }

    @PutMapping("/{id}/password")
    @Operation(summary = "Change password", description = "Change a user's password (self or admin)")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @PathVariable UUID id,
            @RequestBody @Valid ChangePasswordRequest request,
            @AuthenticationPrincipal String username) {
        userService.changePassword(id, request, username);
        return ResponseEntity.ok(ApiResponse.noContent());
    }
}

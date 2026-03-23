package com.observability.auth.service;

import com.observability.auth.dto.PermissionResponse;
import com.observability.auth.dto.RoleRequest;
import com.observability.auth.dto.RoleResponse;
import com.observability.auth.entity.Permission;
import com.observability.auth.entity.Role;
import com.observability.auth.repository.PermissionRepository;
import com.observability.auth.repository.RoleRepository;
import com.observability.shared.exception.ConflictException;
import com.observability.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoleService {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;

    @Transactional(readOnly = true)
    public List<RoleResponse> listRoles() {
        return roleRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public RoleResponse getRoleById(UUID id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id.toString()));
        return toResponse(role);
    }

    @Transactional
    public RoleResponse createRole(RoleRequest request) {
        if (roleRepository.findByName(request.getName()).isPresent()) {
            throw ConflictException.forField("name", "A role with this name already exists");
        }

        Set<Permission> permissions = resolvePermissions(request.getPermissionIds());

        Role role = Role.builder()
                .name(request.getName().toUpperCase())
                .description(request.getDescription())
                .permissions(permissions)
                .build();

        role = roleRepository.save(role);
        log.info("Created role '{}' with {} permissions", role.getName(), permissions.size());

        return toResponse(role);
    }

    @Transactional
    public RoleResponse updateRole(UUID id, RoleRequest request) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Role", id.toString()));

        // Check name conflict if changing name
        if (!role.getName().equalsIgnoreCase(request.getName())) {
            if (roleRepository.findByName(request.getName().toUpperCase()).isPresent()) {
                throw ConflictException.forField("name", "A role with this name already exists");
            }
            role.setName(request.getName().toUpperCase());
        }

        if (request.getDescription() != null) {
            role.setDescription(request.getDescription());
        }

        if (request.getPermissionIds() != null) {
            role.setPermissions(resolvePermissions(request.getPermissionIds()));
        }

        role = roleRepository.save(role);
        log.info("Updated role '{}'", role.getName());

        return toResponse(role);
    }

    @Transactional
    public RoleResponse updatePermissions(UUID roleId, Set<UUID> permissionIds) {
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResourceNotFoundException("Role", roleId.toString()));

        Set<Permission> permissions = resolvePermissions(permissionIds);
        role.setPermissions(permissions);
        role = roleRepository.save(role);
        log.info("Updated permissions for role '{}': {} permissions", role.getName(), permissions.size());

        return toResponse(role);
    }

    @Transactional(readOnly = true)
    public List<PermissionResponse> listPermissions() {
        return permissionRepository.findAll().stream()
                .map(this::toPermissionResponse)
                .toList();
    }

    private Set<Permission> resolvePermissions(Set<UUID> permissionIds) {
        if (permissionIds == null || permissionIds.isEmpty()) {
            return new HashSet<>();
        }

        List<Permission> permissions = permissionRepository.findAllById(permissionIds);
        if (permissions.size() != permissionIds.size()) {
            throw new ResourceNotFoundException("One or more permissions not found");
        }
        return new HashSet<>(permissions);
    }

    private RoleResponse toResponse(Role role) {
        List<PermissionResponse> permissions = role.getPermissions().stream()
                .map(this::toPermissionResponse)
                .toList();

        return RoleResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .permissions(permissions)
                .build();
    }

    private PermissionResponse toPermissionResponse(Permission permission) {
        return PermissionResponse.builder()
                .id(permission.getId())
                .resource(permission.getResource())
                .action(permission.getAction())
                .build();
    }
}

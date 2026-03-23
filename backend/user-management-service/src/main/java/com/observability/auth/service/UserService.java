package com.observability.auth.service;

import com.observability.auth.dto.ChangePasswordRequest;
import com.observability.auth.dto.CreateUserRequest;
import com.observability.auth.dto.PermissionResponse;
import com.observability.auth.dto.RoleResponse;
import com.observability.auth.dto.UpdateUserRequest;
import com.observability.auth.dto.UserResponse;
import com.observability.auth.entity.Role;
import com.observability.auth.entity.User;
import com.observability.auth.repository.RoleRepository;
import com.observability.auth.repository.UserRepository;
import com.observability.shared.exception.ConflictException;
import com.observability.shared.exception.ForbiddenException;
import com.observability.shared.exception.ResourceNotFoundException;
import com.observability.shared.exception.ValidationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public Page<UserResponse> listUsers(Pageable pageable) {
        return userRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));
        return toResponse(user);
    }

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw ConflictException.forField("username", "A user with this username already exists");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw ConflictException.forField("email", "A user with this email already exists");
        }

        Set<Role> roles = resolveRoles(request.getRoleIds());

        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .authProvider("LOCAL")
                .active(true)
                .roles(roles)
                .build();

        user = userRepository.save(user);
        log.info("Created user '{}' with roles {}", user.getUsername(),
                roles.stream().map(Role::getName).toList());

        return toResponse(user);
    }

    @Transactional
    public UserResponse updateUser(UUID id, UpdateUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));

        if (request.getEmail() != null && !request.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(request.getEmail())) {
                throw ConflictException.forField("email", "A user with this email already exists");
            }
            user.setEmail(request.getEmail());
        }

        if (request.getActive() != null) {
            user.setActive(request.getActive());
        }

        user = userRepository.save(user);
        log.info("Updated user '{}'", user.getUsername());

        return toResponse(user);
    }

    @Transactional
    public void deactivateUser(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id.toString()));
        user.setActive(false);
        userRepository.save(user);
        log.info("Deactivated user '{}'", user.getUsername());
    }

    @Transactional
    public UserResponse assignRoles(UUID userId, Set<UUID> roleIds) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        Set<Role> roles = resolveRoles(roleIds);
        user.setRoles(roles);
        user = userRepository.save(user);
        log.info("Assigned roles {} to user '{}'",
                roles.stream().map(Role::getName).toList(), user.getUsername());

        return toResponse(user);
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest request, String authenticatedUsername) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId.toString()));

        // Users can change their own password; admins can change any user's password
        boolean isSelf = user.getUsername().equals(authenticatedUsername);
        if (!isSelf) {
            User requester = userRepository.findByUsername(authenticatedUsername)
                    .orElseThrow(() -> new ResourceNotFoundException("User", authenticatedUsername));
            boolean isAdmin = requester.getRoles().stream()
                    .anyMatch(r -> "ADMIN".equals(r.getName()));
            if (!isAdmin) {
                throw new ForbiddenException("You can only change your own password");
            }
        }

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new ValidationException("currentPassword", "Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        log.info("Password changed for user '{}'", user.getUsername());
    }

    private Set<Role> resolveRoles(Set<UUID> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) {
            // Default to VIEWER role
            Role viewerRole = roleRepository.findByName("VIEWER")
                    .orElseThrow(() -> new ResourceNotFoundException("Role", "VIEWER"));
            return Set.of(viewerRole);
        }

        List<Role> roles = roleRepository.findAllById(roleIds);
        if (roles.size() != roleIds.size()) {
            throw new ResourceNotFoundException("One or more roles not found");
        }
        return new HashSet<>(roles);
    }

    private UserResponse toResponse(User user) {
        List<String> roleNames = user.getRoles().stream()
                .map(Role::getName)
                .toList();

        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .roles(roleNames)
                .active(user.isActive())
                .authProvider(user.getAuthProvider())
                .createdAt(user.getCreatedAt())
                .build();
    }
}

package com.observability.auth.security;

import com.observability.auth.entity.Permission;
import com.observability.auth.entity.Role;
import com.observability.auth.entity.User;
import com.observability.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(
                        String.format("User not found with username: %s", username)));

        if (!user.isActive()) {
            throw new UsernameNotFoundException(
                    String.format("User account is deactivated: %s", username));
        }

        List<GrantedAuthority> authorities = buildAuthorities(user.getRoles());

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .authorities(authorities)
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(!user.isActive())
                .build();
    }

    /**
     * Build the authority list from the user's roles and their associated permissions.
     * Produces authorities in two formats:
     *   - ROLE_ADMIN, ROLE_OPERATOR, ROLE_VIEWER (role-based)
     *   - USERS:CREATE, SERVICES:READ, etc. (permission-based)
     */
    private List<GrantedAuthority> buildAuthorities(Set<Role> roles) {
        List<GrantedAuthority> authorities = new ArrayList<>();

        for (Role role : roles) {
            // Add role authority (e.g., ROLE_ADMIN)
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.getName()));

            // Add individual permission authorities (e.g., USERS:CREATE)
            for (Permission permission : role.getPermissions()) {
                String permissionAuthority = permission.getResource() + ":" + permission.getAction();
                authorities.add(new SimpleGrantedAuthority(permissionAuthority));
            }
        }

        return authorities;
    }
}

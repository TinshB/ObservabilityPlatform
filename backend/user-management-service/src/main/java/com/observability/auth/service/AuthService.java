package com.observability.auth.service;

import com.observability.auth.dto.LoginRequest;
import com.observability.auth.dto.RefreshTokenRequest;
import com.observability.auth.dto.TokenResponse;
import com.observability.auth.entity.RefreshToken;
import com.observability.auth.entity.Role;
import com.observability.auth.entity.User;
import com.observability.auth.repository.RefreshTokenRepository;
import com.observability.auth.repository.RoleRepository;
import com.observability.auth.repository.UserRepository;
import com.observability.auth.security.JwtTokenProvider;
import com.observability.shared.exception.ResourceNotFoundException;
import com.observability.shared.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Authenticate user credentials and issue access + refresh tokens.
     */
    @Transactional
    public TokenResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword()));

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();

        User user = userRepository.findByUsername(userDetails.getUsername())
                .orElseThrow(() -> new ResourceNotFoundException("User", userDetails.getUsername()));

        String accessToken = jwtTokenProvider.generateAccessToken(userDetails);
        String refreshToken = jwtTokenProvider.generateRefreshToken(user);

        log.info("User '{}' authenticated successfully", user.getUsername());

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtTokenProvider.getAccessTokenExpiration())
                .tokenType("Bearer")
                .build();
    }

    /**
     * Validate a refresh token, rotate it (revoke old, issue new), and return new tokens.
     */
    @Transactional
    public TokenResponse refreshToken(RefreshTokenRequest request) {
        RefreshToken storedToken = refreshTokenRepository.findByToken(request.getRefreshToken())
                .orElseThrow(() -> new UnauthorizedException("Invalid refresh token"));

        if (storedToken.isRevoked()) {
            log.warn("Attempt to use revoked refresh token for user '{}'",
                    storedToken.getUser().getUsername());
            throw new UnauthorizedException("Refresh token has been revoked");
        }

        if (storedToken.getExpiryDate().isBefore(Instant.now())) {
            log.warn("Attempt to use expired refresh token for user '{}'",
                    storedToken.getUser().getUsername());
            storedToken.setRevoked(true);
            refreshTokenRepository.save(storedToken);
            throw new UnauthorizedException("Refresh token has expired");
        }

        User user = storedToken.getUser();

        if (!user.isActive()) {
            throw new UnauthorizedException("User account is deactivated");
        }

        // Revoke the old refresh token (rotation)
        storedToken.setRevoked(true);
        refreshTokenRepository.save(storedToken);

        // Build UserDetails from the user entity to generate a new access token
        List<String> authorities = user.getRoles().stream()
                .flatMap(role -> {
                    var roleAuthorities = new java.util.ArrayList<String>();
                    roleAuthorities.add("ROLE_" + role.getName());
                    role.getPermissions().forEach(perm ->
                            roleAuthorities.add(perm.getResource() + ":" + perm.getAction()));
                    return roleAuthorities.stream();
                })
                .toList();

        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .authorities(authorities.toArray(new String[0]))
                .build();

        String newAccessToken = jwtTokenProvider.generateAccessToken(userDetails);
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user);

        log.info("Refresh token rotated for user '{}'", user.getUsername());

        return TokenResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .expiresIn(jwtTokenProvider.getAccessTokenExpiration())
                .tokenType("Bearer")
                .build();
    }

    /**
     * Revoke all active refresh tokens for the specified user (logout).
     */
    @Transactional
    public void logout(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        List<RefreshToken> activeTokens = refreshTokenRepository.findAllByUserAndRevokedFalse(user);
        activeTokens.forEach(token -> token.setRevoked(true));
        refreshTokenRepository.saveAll(activeTokens);

        log.info("All refresh tokens revoked for user '{}'", username);
    }

    /**
     * Process an OAuth2/OIDC login: find or create the user from OIDC claims,
     * assign default VIEWER role, and return JWT tokens.
     */
    @Transactional
    public TokenResponse processOAuthLogin(OidcUser oidcUser) {
        String email = oidcUser.getEmail();
        String preferredUsername = oidcUser.getPreferredUsername();
        String username = (preferredUsername != null) ? preferredUsername : email;

        User user = userRepository.findByEmail(email).orElseGet(() -> {
            log.info("Creating new OAuth user for email '{}'", email);

            Role viewerRole = roleRepository.findByName("VIEWER")
                    .orElseThrow(() -> new ResourceNotFoundException("Role", "VIEWER"));

            Set<Role> roles = new HashSet<>();
            roles.add(viewerRole);

            User newUser = User.builder()
                    .username(username)
                    .email(email)
                    .passwordHash("OAUTH_NO_PASSWORD")
                    .authProvider("AZURE_AD")
                    .active(true)
                    .roles(roles)
                    .build();

            return userRepository.save(newUser);
        });

        if (!user.isActive()) {
            throw new UnauthorizedException("User account is deactivated");
        }

        // Build UserDetails from the user entity
        List<String> authorities = user.getRoles().stream()
                .flatMap(role -> {
                    var roleAuthorities = new java.util.ArrayList<String>();
                    roleAuthorities.add("ROLE_" + role.getName());
                    role.getPermissions().forEach(perm ->
                            roleAuthorities.add(perm.getResource() + ":" + perm.getAction()));
                    return roleAuthorities.stream();
                })
                .toList();

        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .authorities(authorities.toArray(new String[0]))
                .build();

        String accessToken = jwtTokenProvider.generateAccessToken(userDetails);
        String refreshToken = jwtTokenProvider.generateRefreshToken(user);

        log.info("OAuth user '{}' authenticated successfully", user.getUsername());

        return TokenResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(jwtTokenProvider.getAccessTokenExpiration())
                .tokenType("Bearer")
                .build();
    }
}

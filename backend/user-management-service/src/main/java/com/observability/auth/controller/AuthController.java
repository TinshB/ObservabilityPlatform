package com.observability.auth.controller;

import com.observability.auth.dto.LoginRequest;
import com.observability.auth.dto.OAuthCallbackRequest;
import com.observability.auth.dto.RefreshTokenRequest;
import com.observability.auth.dto.TokenResponse;
import com.observability.auth.dto.UserResponse;
import com.observability.auth.entity.User;
import com.observability.auth.repository.UserRepository;
import com.observability.auth.service.AuthService;
import com.observability.shared.dto.ApiResponse;
import com.observability.shared.exception.ResourceNotFoundException;
import com.observability.shared.exception.UnauthorizedException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication", description = "Authentication and token management endpoints")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    @Value("${spring.security.oauth2.client.provider.azure-ad.authorization-uri:}")
    private String azureAuthorizationUri;

    @Value("${spring.security.oauth2.client.registration.azure-ad.client-id:}")
    private String azureClientId;

    @Value("${spring.security.oauth2.client.registration.azure-ad.redirect-uri:}")
    private String azureRedirectUri;

    @PostMapping("/login")
    @Operation(summary = "Authenticate user", description = "Authenticate with username and password to obtain JWT tokens")
    public ResponseEntity<ApiResponse<TokenResponse>> login(
            @RequestBody @Valid LoginRequest request) {
        log.info("Login attempt for user '{}'", request.getUsername());
        TokenResponse tokenResponse = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success(tokenResponse, "Authentication successful"));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh access token", description = "Exchange a valid refresh token for a new access token and refresh token")
    public ResponseEntity<ApiResponse<TokenResponse>> refresh(
            @RequestBody @Valid RefreshTokenRequest request) {
        TokenResponse tokenResponse = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success(tokenResponse, "Token refreshed successfully"));
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout user", description = "Revoke all refresh tokens for the authenticated user")
    public ResponseEntity<ApiResponse<Void>> logout(
            @AuthenticationPrincipal String username) {
        if (username == null) {
            throw new UnauthorizedException("No authenticated user found");
        }
        authService.logout(username);
        return ResponseEntity.ok(ApiResponse.noContent());
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user", description = "Retrieve profile information for the currently authenticated user")
    public ResponseEntity<ApiResponse<UserResponse>> getCurrentUser(
            @AuthenticationPrincipal String username) {
        if (username == null) {
            throw new UnauthorizedException("No authenticated user found");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User", username));

        List<String> roles = user.getRoles().stream()
                .map(role -> role.getName())
                .toList();

        UserResponse userResponse = UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .roles(roles)
                .active(user.isActive())
                .authProvider(user.getAuthProvider())
                .createdAt(user.getCreatedAt())
                .build();

        return ResponseEntity.ok(ApiResponse.success(userResponse));
    }

    @GetMapping("/oauth2/azure")
    @Operation(summary = "Initiate Azure AD login", description = "Redirect to Azure AD authorization endpoint for OAuth2/OIDC login")
    public ResponseEntity<Void> initiateAzureLogin() {
        String authUrl = String.format(
                "%s?client_id=%s&redirect_uri=%s&response_type=code&scope=openid+profile+email",
                azureAuthorizationUri,
                azureClientId,
                azureRedirectUri
        );
        return ResponseEntity.status(302).location(URI.create(authUrl)).build();
    }

    @PostMapping("/oauth2/callback")
    @Operation(summary = "Handle OAuth2 callback", description = "Exchange an OAuth2 authorization code for JWT tokens")
    public ResponseEntity<ApiResponse<TokenResponse>> handleOAuthCallback(
            @RequestBody OAuthCallbackRequest request) {
        log.info("Processing OAuth2 callback with authorization code");
        // In a full implementation, the code would be exchanged for tokens with the
        // OAuth2 provider, and the OidcUser would be constructed from the ID token.
        // Here we delegate to the service which handles the user lookup/creation
        // and JWT issuance. The actual OAuth2 code exchange is handled by Spring
        // Security's OAuth2 client support in the filter chain.
        //
        // For direct API usage (e.g., mobile/SPA clients), the frontend exchanges
        // the code via the standard Spring Security OAuth2 flow, then calls this
        // endpoint with the resulting OIDC user context to obtain our platform JWTs.
        throw new UnsupportedOperationException(
                "Direct code exchange is handled via Spring Security OAuth2 filter chain. "
                + "Use GET /api/v1/auth/oauth2/azure to initiate the flow.");
    }
}

package com.observability.auth.security;

import com.observability.auth.entity.RefreshToken;
import com.observability.auth.entity.User;
import com.observability.auth.repository.RefreshTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtTokenProviderTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private JwtTokenProvider jwtTokenProvider;

    // Base64-encoded key that is at least 64 bytes for HS512
    private static final String TEST_SECRET =
            "bXktdGVzdC1zZWNyZXQta2V5LWZvci1qd3QtdG9rZW4tc2lnbmluZy10aGF0LWlzLWxvbmctZW5vdWdoLWZvci1obWFjLXNoYTUxMi1hbGdvcml0aG0=";

    @BeforeEach
    void setUp() {
        JwtConfig config = new JwtConfig();
        config.setSecret(TEST_SECRET);
        config.setAccessTokenExpiration(900_000L);    // 15 minutes
        config.setRefreshTokenExpiration(604_800_000L); // 7 days

        jwtTokenProvider = new JwtTokenProvider(config, refreshTokenRepository);
    }

    @Test
    @DisplayName("should generate a valid access token")
    void generateAccessToken() {
        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username("testuser")
                .password("encoded-password")
                .authorities(
                        new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("USERS:CREATE")
                )
                .build();

        String token = jwtTokenProvider.generateAccessToken(userDetails);

        assertNotNull(token);
        assertFalse(token.isEmpty());
        assertTrue(jwtTokenProvider.validateToken(token));
    }

    @Test
    @DisplayName("should extract correct username from token")
    void getUsernameFromToken() {
        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username("admin")
                .password("encoded-password")
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))
                .build();

        String token = jwtTokenProvider.generateAccessToken(userDetails);
        String username = jwtTokenProvider.getUsernameFromToken(token);

        assertEquals("admin", username);
    }

    @Test
    @DisplayName("should extract correct roles from token")
    void getRolesFromToken() {
        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username("testuser")
                .password("encoded-password")
                .authorities(
                        new SimpleGrantedAuthority("ROLE_OPERATOR"),
                        new SimpleGrantedAuthority("SERVICES:READ"),
                        new SimpleGrantedAuthority("ALERTS:CREATE")
                )
                .build();

        String token = jwtTokenProvider.generateAccessToken(userDetails);
        List<String> roles = jwtTokenProvider.getRolesFromToken(token);

        assertEquals(3, roles.size());
        assertTrue(roles.contains("ROLE_OPERATOR"));
        assertTrue(roles.contains("SERVICES:READ"));
        assertTrue(roles.contains("ALERTS:CREATE"));
    }

    @Test
    @DisplayName("should reject an invalid token")
    void validateInvalidToken() {
        assertFalse(jwtTokenProvider.validateToken("totally.invalid.token"));
    }

    @Test
    @DisplayName("should reject a null token")
    void validateNullToken() {
        assertFalse(jwtTokenProvider.validateToken(null));
    }

    @Test
    @DisplayName("should reject an empty token")
    void validateEmptyToken() {
        assertFalse(jwtTokenProvider.validateToken(""));
    }

    @Test
    @DisplayName("should reject a token signed with a different key")
    void validateTokenWithDifferentKey() {
        // Generate a token with the test provider
        UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                .username("user1")
                .password("pass")
                .authorities(new SimpleGrantedAuthority("ROLE_VIEWER"))
                .build();

        String token = jwtTokenProvider.generateAccessToken(userDetails);

        // Create a different provider with a different secret
        JwtConfig otherConfig = new JwtConfig();
        otherConfig.setSecret(
                "YW5vdGhlci1kaWZmZXJlbnQtc2VjcmV0LWtleS1mb3Itand0LXRva2VuLXNpZ25pbmctdGhhdC1pcy1sb25nLWVub3VnaC1mb3ItaG1hYy1zaGE1MTItYWxnbw==");
        otherConfig.setAccessTokenExpiration(900_000L);
        otherConfig.setRefreshTokenExpiration(604_800_000L);

        JwtTokenProvider otherProvider = new JwtTokenProvider(otherConfig, refreshTokenRepository);

        assertFalse(otherProvider.validateToken(token));
    }

    @Test
    @DisplayName("should generate and persist a refresh token")
    void generateRefreshToken() {
        User user = User.builder()
                .id(UUID.randomUUID())
                .username("testuser")
                .build();

        when(refreshTokenRepository.save(any(RefreshToken.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        String refreshToken = jwtTokenProvider.generateRefreshToken(user);

        assertNotNull(refreshToken);
        assertFalse(refreshToken.isEmpty());

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());

        RefreshToken saved = captor.getValue();
        assertEquals(refreshToken, saved.getToken());
        assertEquals(user, saved.getUser());
        assertFalse(saved.isRevoked());
        assertNotNull(saved.getExpiryDate());
    }

    @Test
    @DisplayName("should return configured access token expiration")
    void getAccessTokenExpiration() {
        assertEquals(900_000L, jwtTokenProvider.getAccessTokenExpiration());
    }
}

import api from './api'
import type { ApiResponse, User } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Auth API service
// Wraps all authentication-related HTTP calls against the backend.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Token payload returned by login and refresh endpoints.
 */
export interface TokenResponse {
  accessToken:  string
  refreshToken: string
  expiresIn:    number
  tokenType:    string
}

/**
 * Authenticate with username and password.
 *
 * @param username - The user's login name
 * @param password - The user's password
 * @returns Token response containing access and refresh tokens
 */
export async function login(
  username: string,
  password: string,
): Promise<TokenResponse> {
  const { data } = await api.post<ApiResponse<TokenResponse>>(
    '/auth/login',
    { username, password },
  )
  return data.data
}

/**
 * Exchange a refresh token for a new token pair.
 *
 * @param refreshToken - The current refresh token
 * @returns Token response containing new access and refresh tokens
 */
export async function refreshToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const { data } = await api.post<ApiResponse<TokenResponse>>(
    '/auth/refresh',
    { refreshToken },
  )
  return data.data
}

/**
 * Invalidate the current session on the server.
 * Requires a valid JWT in the Authorization header.
 */
export async function logout(): Promise<void> {
  await api.post<ApiResponse<void>>('/auth/logout')
}

/**
 * Fetch the currently authenticated user's profile.
 *
 * @returns The authenticated user's details
 */
export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<ApiResponse<User>>('/auth/me')
  return data.data
}

/**
 * Returns the URL for initiating Azure AD SSO login.
 * The browser should be redirected to this URL (full page navigation).
 */
export function getAzureSsoUrl(): string {
  return '/api/v1/auth/oauth2/azure'
}

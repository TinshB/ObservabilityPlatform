import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'
import { Visibility, VisibilityOff } from '@mui/icons-material'
import { useAuth } from '@/hooks/useAuth'
import { getAzureSsoUrl } from '@/services/authService'

/**
 * Login page -- username/password form with Azure AD SSO option.
 *
 * On successful authentication the user is redirected to the original
 * destination (from location.state.from) or /dashboard by default.
 * Already-authenticated users are redirected immediately.
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, loading, error, login, clearError } = useAuth()

  const [username, setUsername]               = useState('')
  const [password, setPassword]               = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [rememberMe, setRememberMe]           = useState(false)
  const [usernameError, setUsernameError]     = useState('')
  const [passwordError, setPasswordError]     = useState('')

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/home'

  // Redirect immediately if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  // Clear server error when the user starts typing
  useEffect(() => {
    if (error) {
      clearError()
    }
    // Only clear when inputs change, not when error itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, password])

  /**
   * Validate form fields and return true if valid.
   */
  function validate(): boolean {
    let valid = true

    if (!username.trim()) {
      setUsernameError('Username is required')
      valid = false
    } else {
      setUsernameError('')
    }

    if (!password) {
      setPasswordError('Password is required')
      valid = false
    } else {
      setPasswordError('')
    }

    return valid
  }

  /**
   * Handle form submission.
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (!validate()) return

    try {
      await login(username, password)
      // Navigation happens via the useEffect above once isAuthenticated becomes true
    } catch {
      // Error is already set in the store by loginAsync
    }
  }

  /**
   * Redirect the browser to the Azure AD SSO endpoint.
   */
  function handleAzureSso(): void {
    window.location.href = getAzureSsoUrl()
  }

  function handleTogglePasswordVisibility(): void {
    setShowPassword((prev) => !prev)
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Sign In
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={!!usernameError}
          helperText={usernameError}
          required
          fullWidth
          autoFocus
          autoComplete="username"
          margin="normal"
          disabled={loading}
        />

        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={!!passwordError}
          helperText={passwordError}
          required
          fullWidth
          autoComplete="current-password"
          margin="normal"
          disabled={loading}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={handleTogglePasswordVisibility}
                  edge="end"
                  size="small"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              size="small"
              disabled={loading}
            />
          }
          label={
            <Typography variant="body2">Remember me</Typography>
          }
          sx={{ mt: 0.5, mb: 1 }}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          sx={{ mt: 1, mb: 2, textTransform: 'none', fontWeight: 600 }}
        >
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            'Sign In'
          )}
        </Button>

        <Divider sx={{ my: 2 }}>
          <Typography variant="body2" color="text.secondary">
            OR
          </Typography>
        </Divider>

        <Button
          variant="outlined"
          fullWidth
          size="large"
          onClick={handleAzureSso}
          disabled={loading}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Sign in with Microsoft
        </Button>
      </Box>
    </Box>
  )
}

import { useState } from 'react'
import {
  Box, Typography, Paper, TextField, Button, Chip, Alert, Snackbar,
  Avatar, Grid,
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import { useAuth } from '@/hooks/useAuth'
import * as userService from '@/services/userService'
import { type FieldErrors, parseApiError, hasFieldErrors, clearFieldError } from '@/utils/formErrors'

export default function ProfilePage() {
  const { user } = useAuth()
  const [form, setForm]             = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [snackbar, setSnackbar]     = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const [saving, setSaving]         = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const handleChangePassword = async () => {
    if (form.newPassword !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' })
      return
    }
    if (!user) return

    setSaving(true)
    try {
      await userService.changePassword(user.id, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      })
      setSnackbar({ open: true, message: 'Password changed successfully', severity: 'success' })
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setFieldErrors({})
    } catch (err: unknown) {
      const { fieldErrors: fe, message } = parseApiError(err)
      setFieldErrors(fe)
      if (!hasFieldErrors(fe)) {
        setSnackbar({ open: true, message, severity: 'error' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <Box sx={{ maxWidth: 700 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>My Profile</Typography>

      {/* ── Profile Info ────────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
            <PersonIcon fontSize="large" />
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={600}>{user.username}</Typography>
            <Typography variant="body2" color="text.secondary">{user.email}</Typography>
          </Box>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Username</Typography>
            <Typography>{user.username}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Email</Typography>
            <Typography>{user.email}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Roles</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              {user.roles.map((role) => (
                <Chip key={role} label={role} size="small"
                  color={role === 'ADMIN' ? 'error' : role === 'OPERATOR' ? 'warning' : 'default'} />
              ))}
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">Member Since</Typography>
            <Typography>{new Date(user.createdAt).toLocaleDateString()}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* ── Change Password ─────────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Change Password</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Current Password" type="password" value={form.currentPassword}
            error={!!fieldErrors.currentPassword}
            helperText={fieldErrors.currentPassword}
            onChange={(e) => { setForm(f => ({ ...f, currentPassword: e.target.value })); setFieldErrors(prev => clearFieldError(prev, 'currentPassword')) }} />
          <TextField label="New Password" type="password" value={form.newPassword}
            error={!!fieldErrors.newPassword}
            helperText={fieldErrors.newPassword || 'Minimum 6 characters'}
            onChange={(e) => { setForm(f => ({ ...f, newPassword: e.target.value })); setFieldErrors(prev => clearFieldError(prev, 'newPassword')) }} />
          <TextField label="Confirm New Password" type="password" value={form.confirmPassword}
            error={!!fieldErrors.confirmPassword || (form.confirmPassword !== '' && form.newPassword !== form.confirmPassword)}
            helperText={fieldErrors.confirmPassword || (form.confirmPassword !== '' && form.newPassword !== form.confirmPassword ? 'Passwords do not match' : '')}
            onChange={(e) => { setForm(f => ({ ...f, confirmPassword: e.target.value })); setFieldErrors(prev => clearFieldError(prev, 'confirmPassword')) }} />
          <Button variant="contained" onClick={handleChangePassword} disabled={saving || !form.currentPassword || !form.newPassword || !form.confirmPassword}
            sx={{ alignSelf: 'flex-start' }}>
            {saving ? 'Saving...' : 'Change Password'}
          </Button>
        </Box>
      </Paper>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

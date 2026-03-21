import { useState } from 'react'
import {
  Box, Typography, Paper, TextField, Button, Chip, Alert, Snackbar,
  Avatar, Grid,
} from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import { useAuth } from '@/hooks/useAuth'
import * as userService from '@/services/userService'

export default function ProfilePage() {
  const { user } = useAuth()
  const [form, setForm]         = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })
  const [saving, setSaving]     = useState(false)

  const handleChangePassword = async () => {
    if (form.newPassword !== form.confirmPassword) {
      setSnackbar({ open: true, message: 'Passwords do not match', severity: 'error' })
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
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to change password'
      setSnackbar({ open: true, message: msg, severity: 'error' })
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
            onChange={(e) => setForm(f => ({ ...f, currentPassword: e.target.value }))} />
          <TextField label="New Password" type="password" value={form.newPassword}
            onChange={(e) => setForm(f => ({ ...f, newPassword: e.target.value }))}
            helperText="Minimum 6 characters" />
          <TextField label="Confirm New Password" type="password" value={form.confirmPassword}
            onChange={(e) => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
            error={form.confirmPassword !== '' && form.newPassword !== form.confirmPassword}
            helperText={form.confirmPassword !== '' && form.newPassword !== form.confirmPassword ? 'Passwords do not match' : ''} />
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

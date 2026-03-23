import { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, FormControl, InputLabel, Select,
  MenuItem, OutlinedInput, Checkbox, ListItemText, Alert, Snackbar, Tooltip,
  Switch, FormControlLabel,
} from '@mui/material'
import AddIcon       from '@mui/icons-material/Add'
import EditIcon      from '@mui/icons-material/Edit'
import BlockIcon     from '@mui/icons-material/Block'
import GroupIcon     from '@mui/icons-material/Group'
import type { UserDetail, Role, PagedResponse } from '@/types'
import * as userService from '@/services/userService'
import * as roleService from '@/services/roleService'
import { type FieldErrors, parseApiError, hasFieldErrors, clearFieldError } from '@/utils/formErrors'

export default function UsersPage() {
  const [users, setUsers]       = useState<UserDetail[]>([])
  const [roles, setRoles]       = useState<Role[]>([])
  const [page, setPage]         = useState(0)
  const [size, setSize]         = useState(20)
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  // Create dialog
  const [createOpen, setCreateOpen]     = useState(false)
  const [createForm, setCreateForm]     = useState({ username: '', email: '', password: '', roleIds: [] as string[] })
  const [createErrors, setCreateErrors] = useState<FieldErrors>({})

  // Edit dialog
  const [editOpen, setEditOpen]         = useState(false)
  const [editUser, setEditUser]         = useState<UserDetail | null>(null)
  const [editForm, setEditForm]         = useState({ email: '', active: true })
  const [editErrors, setEditErrors]     = useState<FieldErrors>({})

  // Roles dialog
  const [rolesOpen, setRolesOpen]       = useState(false)
  const [rolesUser, setRolesUser]       = useState<UserDetail | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data: PagedResponse<UserDetail> = await userService.getUsers(page, size)
      setUsers(data.content)
      setTotal(data.totalElements)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load users', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, size])

  const fetchRoles = useCallback(async () => {
    try {
      const data = await roleService.getRoles()
      setRoles(data)
    } catch { /* roles needed for dropdowns */ }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])
  useEffect(() => { fetchRoles() }, [fetchRoles])

  // ── Create user ───────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      await userService.createUser(createForm)
      setSnackbar({ open: true, message: 'User created successfully', severity: 'success' })
      setCreateOpen(false)
      setCreateForm({ username: '', email: '', password: '', roleIds: [] })
      setCreateErrors({})
      fetchUsers()
    } catch (err: unknown) {
      const { fieldErrors, message } = parseApiError(err)
      setCreateErrors(fieldErrors)
      if (!hasFieldErrors(fieldErrors)) {
        setSnackbar({ open: true, message, severity: 'error' })
      }
    }
  }

  // ── Edit user ─────────────────────────────────────────────────
  const openEdit = (user: UserDetail) => {
    setEditUser(user)
    setEditForm({ email: user.email, active: user.active })
    setEditErrors({})
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editUser) return
    try {
      await userService.updateUser(editUser.id, editForm)
      setSnackbar({ open: true, message: 'User updated successfully', severity: 'success' })
      setEditOpen(false)
      setEditErrors({})
      fetchUsers()
    } catch (err: unknown) {
      const { fieldErrors, message } = parseApiError(err)
      setEditErrors(fieldErrors)
      if (!hasFieldErrors(fieldErrors)) {
        setSnackbar({ open: true, message, severity: 'error' })
      }
    }
  }

  // ── Deactivate user ───────────────────────────────────────────
  const handleDeactivate = async (user: UserDetail) => {
    if (!window.confirm(`Deactivate user "${user.username}"?`)) return
    try {
      await userService.deactivateUser(user.id)
      setSnackbar({ open: true, message: 'User deactivated', severity: 'success' })
      fetchUsers()
    } catch {
      setSnackbar({ open: true, message: 'Failed to deactivate user', severity: 'error' })
    }
  }

  // ── Assign roles ──────────────────────────────────────────────
  const openRoles = (user: UserDetail) => {
    setRolesUser(user)
    const userRoleIds = roles.filter(r => (user.roles as string[]).includes(r.name)).map(r => r.id)
    setSelectedRoles(userRoleIds)
    setRolesOpen(true)
  }

  const handleAssignRoles = async () => {
    if (!rolesUser) return
    try {
      await userService.assignRoles(rolesUser.id, selectedRoles)
      setSnackbar({ open: true, message: 'Roles assigned successfully', severity: 'success' })
      setRolesOpen(false)
      fetchUsers()
    } catch {
      setSnackbar({ open: true, message: 'Failed to assign roles', severity: 'error' })
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>User Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Create User
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} align="center">Loading...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={6} align="center">No users found</TableCell></TableRow>
            ) : users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.username}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {user.roles.map((role) => (
                    <Chip key={role} label={role} size="small" sx={{ mr: 0.5 }}
                      color={role === 'ADMIN' ? 'error' : role === 'OPERATOR' ? 'warning' : 'default'} />
                  ))}
                </TableCell>
                <TableCell>{user.authProvider}</TableCell>
                <TableCell>
                  <Chip label={user.active ? 'Active' : 'Inactive'} size="small"
                    color={user.active ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(user)}><EditIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Assign Roles">
                    <IconButton size="small" onClick={() => openRoles(user)}><GroupIcon fontSize="small" /></IconButton>
                  </Tooltip>
                  <Tooltip title="Deactivate">
                    <IconButton size="small" onClick={() => handleDeactivate(user)} disabled={!user.active}>
                      <BlockIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={size}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setSize(parseInt(e.target.value)); setPage(0) }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </TableContainer>

      {/* ── Create User Dialog ──────────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); setCreateErrors({}) }} maxWidth="sm" fullWidth>
        <DialogTitle>Create User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Username" required value={createForm.username}
            error={!!createErrors.username}
            helperText={createErrors.username}
            onChange={(e) => { setCreateForm(f => ({ ...f, username: e.target.value })); setCreateErrors(prev => clearFieldError(prev, 'username')) }} />
          <TextField label="Email" type="email" required value={createForm.email}
            error={!!createErrors.email}
            helperText={createErrors.email}
            onChange={(e) => { setCreateForm(f => ({ ...f, email: e.target.value })); setCreateErrors(prev => clearFieldError(prev, 'email')) }} />
          <TextField label="Password" type="password" required value={createForm.password}
            error={!!createErrors.password}
            helperText={createErrors.password}
            onChange={(e) => { setCreateForm(f => ({ ...f, password: e.target.value })); setCreateErrors(prev => clearFieldError(prev, 'password')) }} />
          <FormControl>
            <InputLabel>Roles</InputLabel>
            <Select multiple value={createForm.roleIds} input={<OutlinedInput label="Roles" />}
              onChange={(e) => setCreateForm(f => ({ ...f, roleIds: e.target.value as string[] }))}
              renderValue={(sel) => sel.map(id => roles.find(r => r.id === id)?.name).join(', ')}>
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  <Checkbox checked={createForm.roleIds.includes(role.id)} />
                  <ListItemText primary={role.name} secondary={role.description} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}
            disabled={!createForm.username || !createForm.email || !createForm.password}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit User Dialog ────────────────────────────────────── */}
      <Dialog open={editOpen} onClose={() => { setEditOpen(false); setEditErrors({}) }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User: {editUser?.username}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Email" type="email" value={editForm.email}
            error={!!editErrors.email}
            helperText={editErrors.email}
            onChange={(e) => { setEditForm(f => ({ ...f, email: e.target.value })); setEditErrors(prev => clearFieldError(prev, 'email')) }} />
          <FormControlLabel
            control={<Switch checked={editForm.active} onChange={(e) => setEditForm(f => ({ ...f, active: e.target.checked }))} />}
            label={editForm.active ? 'Active' : 'Inactive'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* ── Assign Roles Dialog ─────────────────────────────────── */}
      <Dialog open={rolesOpen} onClose={() => setRolesOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Roles: {rolesUser?.username}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Roles</InputLabel>
            <Select multiple value={selectedRoles} input={<OutlinedInput label="Roles" />}
              onChange={(e) => setSelectedRoles(e.target.value as string[])}
              renderValue={(sel) => sel.map(id => roles.find(r => r.id === id)?.name).join(', ')}>
              {roles.map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  <Checkbox checked={selectedRoles.includes(role.id)} />
                  <ListItemText primary={role.name} secondary={role.description} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRolesOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAssignRoles} disabled={selectedRoles.length === 0}>
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ────────────────────────────────────────────── */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

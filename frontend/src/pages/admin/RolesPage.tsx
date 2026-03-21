import React, { useEffect, useState, useCallback } from 'react'
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Checkbox, FormGroup, FormControlLabel, Alert,
  Snackbar, Tooltip, Collapse, Divider,
} from '@mui/material'
import AddIcon        from '@mui/icons-material/Add'
import SecurityIcon   from '@mui/icons-material/Security'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import type { Role, Permission } from '@/types'
import * as roleService from '@/services/roleService'

export default function RolesPage() {
  const [roles, setRoles]             = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading]         = useState(true)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [snackbar, setSnackbar]       = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', description: '', permissionIds: [] as string[] })

  // Edit permissions dialog
  const [permOpen, setPermOpen]           = useState(false)
  const [permRole, setPermRole]           = useState<Role | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesData, permsData] = await Promise.all([
        roleService.getRoles(),
        roleService.getPermissions(),
      ])
      setRoles(rolesData)
      setPermissions(permsData)
    } catch {
      setSnackbar({ open: true, message: 'Failed to load data', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Group permissions by resource for the checkbox matrix
  const permissionsByResource = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.resource] ??= []).push(p)
    return acc
  }, {})

  // ── Create role ───────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      await roleService.createRole(createForm)
      setSnackbar({ open: true, message: 'Role created successfully', severity: 'success' })
      setCreateOpen(false)
      setCreateForm({ name: '', description: '', permissionIds: [] })
      fetchData()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create role'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    }
  }

  // ── Edit permissions ──────────────────────────────────────────
  const openPermissions = (role: Role) => {
    setPermRole(role)
    setSelectedPerms(role.permissions.map(p => p.id))
    setPermOpen(true)
  }

  const handleUpdatePermissions = async () => {
    if (!permRole) return
    try {
      await roleService.updateRolePermissions(permRole.id, selectedPerms)
      setSnackbar({ open: true, message: 'Permissions updated successfully', severity: 'success' })
      setPermOpen(false)
      fetchData()
    } catch {
      setSnackbar({ open: true, message: 'Failed to update permissions', severity: 'error' })
    }
  }

  const togglePermission = (permId: string) => {
    setSelectedPerms(prev =>
      prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]
    )
  }

  const toggleResourceAll = (resource: string) => {
    const resourcePermIds = permissionsByResource[resource]?.map(p => p.id) || []
    const allSelected = resourcePermIds.every(id => selectedPerms.includes(id))
    if (allSelected) {
      setSelectedPerms(prev => prev.filter(id => !resourcePermIds.includes(id)))
    } else {
      setSelectedPerms(prev => [...new Set([...prev, ...resourcePermIds])])
    }
  }

  // ── Permission checkbox matrix (shared between create and edit) ──
  const renderPermissionMatrix = (selected: string[], toggle: (id: string) => void, toggleResource: (r: string) => void) => (
    <Box sx={{ mt: 1 }}>
      {Object.entries(permissionsByResource).map(([resource, perms]) => {
        const allSelected = perms.every(p => selected.includes(p.id))
        const someSelected = perms.some(p => selected.includes(p.id))
        return (
          <Box key={resource} sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox checked={allSelected} indeterminate={someSelected && !allSelected}
                  onChange={() => toggleResource(resource)} />
              }
              label={<Typography fontWeight={600} fontSize="0.875rem">{resource}</Typography>}
            />
            <FormGroup row sx={{ pl: 4 }}>
              {perms.map(p => (
                <FormControlLabel key={p.id}
                  control={<Checkbox size="small" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />}
                  label={p.action} />
              ))}
            </FormGroup>
          </Box>
        )
      })}
    </Box>
  )

  // Create dialog permission helpers
  const toggleCreatePerm = (permId: string) => {
    setCreateForm(f => ({
      ...f,
      permissionIds: f.permissionIds.includes(permId)
        ? f.permissionIds.filter(id => id !== permId)
        : [...f.permissionIds, permId],
    }))
  }

  const toggleCreateResource = (resource: string) => {
    const resourcePermIds = permissionsByResource[resource]?.map(p => p.id) || []
    const allSelected = resourcePermIds.every(id => createForm.permissionIds.includes(id))
    setCreateForm(f => ({
      ...f,
      permissionIds: allSelected
        ? f.permissionIds.filter(id => !resourcePermIds.includes(id))
        : [...new Set([...f.permissionIds, ...resourcePermIds])],
    }))
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Role Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Create Role
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40} />
              <TableCell>Role</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Permissions</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center">Loading...</TableCell></TableRow>
            ) : roles.map((role) => (
              <React.Fragment key={role.id}>
                <TableRow>
                  <TableCell>
                    <IconButton size="small" onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}>
                      {expandedRole === role.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={600}>{role.name}</Typography>
                  </TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>
                    <Chip label={`${role.permissions.length} permissions`} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit Permissions">
                      <IconButton size="small" onClick={() => openPermissions(role)}>
                        <SecurityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={5} sx={{ py: 0, borderBottom: expandedRole === role.id ? undefined : 'none' }}>
                    <Collapse in={expandedRole === role.id}>
                      <Box sx={{ py: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Assigned Permissions</Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {role.permissions.map(p => (
                            <Chip key={p.id} label={`${p.resource}:${p.action}`} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Create Role Dialog ──────────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Role</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="Role Name" required value={createForm.name}
            onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="Description" value={createForm.description}
            onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))} />
          <Divider />
          <Typography variant="subtitle2">Permissions</Typography>
          {renderPermissionMatrix(createForm.permissionIds, toggleCreatePerm, toggleCreateResource)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!createForm.name}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Permissions Dialog ─────────────────────────────── */}
      <Dialog open={permOpen} onClose={() => setPermOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Permissions: {permRole?.name}</DialogTitle>
        <DialogContent>
          {renderPermissionMatrix(selectedPerms, togglePermission, toggleResourceAll)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdatePermissions}>Save</Button>
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

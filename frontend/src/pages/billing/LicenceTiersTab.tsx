import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Divider,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import PeopleIcon from '@mui/icons-material/People'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import type {
  LicenceTier,
  CreateLicenceTierPayload,
  UpdateLicenceTierPayload,
  LicenceCostSummaryResponse,
} from '@/types'
import * as billingService from '@/services/billingService'
import { useAuth } from '@/hooks/useAuth'
import SummaryCard from './SummaryCard'
import { formatCurrency } from './formatUtils'

interface Props {
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

const EMPTY_FORM: CreateLicenceTierPayload = { tierName: '', userType: '', monthlyCostUsd: 0 }

export default function LicenceTiersTab({ onError, onSuccess }: Props) {
  const { hasRole } = useAuth()
  const canManageTiers = hasRole('SUPER_ADMIN')
  const [tiers, setTiers] = useState<LicenceTier[]>([])
  const [summary, setSummary] = useState<LicenceCostSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<LicenceTier | null>(null)
  const [form, setForm] = useState<CreateLicenceTierPayload>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchTiers = useCallback(async () => {
    setLoading(true)
    try {
      const result = await billingService.getLicenceTiers()
      setTiers(result)
    } catch {
      onError('Failed to load licence tiers')
    } finally {
      setLoading(false)
    }
  }, [onError])

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true)
    try {
      const result = await billingService.getLicenceCostSummary()
      setSummary(result)
    } catch {
      // Summary might fail if user-service is down — non-critical
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTiers()
    fetchSummary()
  }, [fetchTiers, fetchSummary])

  // ── Dialog handlers ────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingTier(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEditDialog = (tier: LicenceTier) => {
    setEditingTier(tier)
    setForm({
      tierName: tier.tierName,
      userType: tier.userType,
      monthlyCostUsd: tier.monthlyCostUsd,
    })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingTier(null)
    setForm(EMPTY_FORM)
  }

  const handleSave = async () => {
    if (!form.tierName.trim() || !form.userType.trim()) {
      onError('Tier name and user type are required')
      return
    }
    setSaving(true)
    try {
      if (editingTier) {
        const payload: UpdateLicenceTierPayload = {
          tierName: form.tierName,
          userType: form.userType,
          monthlyCostUsd: form.monthlyCostUsd,
        }
        await billingService.updateLicenceTier(editingTier.id, payload)
        onSuccess(`Tier "${form.tierName}" updated`)
      } else {
        await billingService.createLicenceTier(form)
        onSuccess(`Tier "${form.tierName}" created`)
      }
      closeDialog()
      fetchTiers()
      fetchSummary()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to save licence tier'
      onError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tier: LicenceTier) => {
    if (!window.confirm(`Delete tier "${tier.tierName}"? This cannot be undone.`)) return
    try {
      await billingService.deleteLicenceTier(tier.id)
      onSuccess(`Tier "${tier.tierName}" deleted`)
      fetchTiers()
      fetchSummary()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to delete tier'
      onError(msg)
    }
  }

  const handleToggleActive = async (tier: LicenceTier) => {
    try {
      await billingService.updateLicenceTier(tier.id, { active: !tier.active })
      onSuccess(`Tier "${tier.tierName}" ${tier.active ? 'deactivated' : 'activated'}`)
      fetchTiers()
      fetchSummary()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to update tier'
      onError(msg)
    }
  }

  // AC3: CSV export
  const handleExportCsv = () => {
    if (!summary) return
    const rows = [
      ['User Type', 'Tier Name', 'User Count', 'Cost Per User (USD)', 'Total Monthly Cost (USD)', 'Status'],
      ...summary.tiers.map(t => [
        t.userType,
        t.tierName,
        String(t.userCount),
        String(t.costPerUserUsd),
        String(t.totalMonthlyCostUsd),
        t.active ? 'Active' : 'Inactive',
      ]),
      ['', '', '', '', '', ''],
      ['TOTAL', '', String(summary.totalUsers), '', String(summary.totalMonthlyCostUsd), ''],
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `licence-cost-summary-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box>
      {/* ── Summary Cards ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <SummaryCard
          title="Licensed Users"
          value={summary ? String(summary.totalUsers) : undefined}
          icon={<PeopleIcon />}
          color="primary"
          loading={summaryLoading}
        />
        <SummaryCard
          title="Monthly Cost"
          value={summary ? formatCurrency(summary.totalMonthlyCostUsd) : undefined}
          icon={<AttachMoneyIcon />}
          color="success"
          loading={summaryLoading}
        />
        <SummaryCard
          title="Annual Projection"
          value={summary ? formatCurrency(summary.totalAnnualCostUsd) : undefined}
          icon={<CalendarMonthIcon />}
          color="info"
          loading={summaryLoading}
        />
        <SummaryCard
          title="Active Tiers"
          value={loading ? undefined : String(tiers.filter(t => t.active).length)}
          subtitle={`of ${tiers.length} total`}
          icon={<PeopleIcon />}
          color="warning"
          loading={loading}
        />
      </Box>

      {/* ── Cost Summary Table (US-BILL-010) ────────────────────────────── */}
      <Paper sx={{ overflow: 'hidden', mb: 3 }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>Licence Cost Summary</Typography>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportCsv}
            disabled={!summary || summary.tiers.length === 0}
            size="small"
          >
            Export CSV
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User Type</TableCell>
                <TableCell>Tier</TableCell>
                <TableCell align="right">Users</TableCell>
                <TableCell align="right">Cost / User</TableCell>
                <TableCell align="right">Monthly Total</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summaryLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton variant="text" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !summary || summary.tiers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No licence cost data available
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {summary.tiers.map(tier => (
                    <TableRow key={tier.userType} hover>
                      <TableCell>
                        <Chip label={tier.userType} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{tier.tierName}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>{tier.userCount}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{formatCurrency(tier.costPerUserUsd)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600} color="success.main">
                          {formatCurrency(tier.totalMonthlyCostUsd)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={tier.active ? 'Active' : 'Inactive'}
                          size="small"
                          color={tier.active ? 'success' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ '& td': { fontWeight: 700, borderTop: 2, borderColor: 'divider' } }}>
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell align="right">{summary.totalUsers}</TableCell>
                    <TableCell />
                    <TableCell align="right" sx={{ color: 'success.main' }}>
                      {formatCurrency(summary.totalMonthlyCostUsd)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {canManageTiers && (
        <>
          <Divider sx={{ my: 3 }} />

          {/* ── Tier Configuration Table (US-BILL-009) — SUPER_ADMIN only ──── */}
          <Paper sx={{ overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" fontWeight={600}>Tier Configuration</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
                size="small"
              >
                Add Tier
              </Button>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tier Name</TableCell>
                    <TableCell>User Type</TableCell>
                    <TableCell align="right">Monthly Cost (USD)</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}><Skeleton variant="text" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : tiers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No licence tiers configured
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tiers.map(tier => (
                      <TableRow key={tier.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{tier.tierName}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={tier.userType} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight={600} color="success.main">
                            {formatCurrency(tier.monthlyCostUsd)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={tier.active ? 'Active' : 'Inactive'}
                            size="small"
                            color={tier.active ? 'success' : 'default'}
                            onClick={() => handleToggleActive(tier)}
                            sx={{ cursor: 'pointer' }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditDialog(tier)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={tier.active ? 'Deactivate before deleting' : 'Delete'}>
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={tier.active}
                                onClick={() => handleDelete(tier)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
              )}
            </TableBody>
          </Table>
            </TableContainer>
          </Paper>
        </>
      )}

      {/* ── Create / Edit Dialog (SUPER_ADMIN only) ───────────────────── */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTier ? 'Edit Licence Tier' : 'Create Licence Tier'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Tier Name"
              value={form.tierName}
              onChange={e => setForm(prev => ({ ...prev, tierName: e.target.value }))}
              fullWidth
              required
              placeholder="e.g., Administrator"
            />
            <TextField
              label="User Type"
              value={form.userType}
              onChange={e => setForm(prev => ({ ...prev, userType: e.target.value.toUpperCase() }))}
              fullWidth
              required
              placeholder="e.g., ADMIN"
              helperText="Maps to a user role (ADMIN, OPERATOR, VIEWER)"
            />
            <TextField
              label="Monthly Cost (USD)"
              type="number"
              value={form.monthlyCostUsd}
              onChange={e => setForm(prev => ({ ...prev, monthlyCostUsd: parseFloat(e.target.value) || 0 }))}
              fullWidth
              required
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.tierName.trim() || !form.userType.trim()}
          >
            {saving ? 'Saving…' : editingTier ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

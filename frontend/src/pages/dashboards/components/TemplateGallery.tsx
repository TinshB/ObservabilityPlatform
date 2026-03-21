import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Grid,
  Skeleton,
  Collapse,
  IconButton,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { Dashboard } from '@/types/dashboard'
import { listTemplates } from '@/services/dashboardService'

interface Props {
  onClone: (templateId: string, sourceName: string) => void
}

export default function TemplateGallery({ onClone }: Props) {
  const [templates, setTemplates] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await listTemplates()
        setTemplates(data)
      } catch {
        // silently fail — templates are optional
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (!loading && templates.length === 0) return null

  return (
    <Box sx={{ mb: 4 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <ViewQuiltIcon color="primary" fontSize="small" />
        <Typography variant="subtitle1" fontWeight={700}>
          Templates
        </Typography>
        <Chip label={loading ? '...' : templates.length} size="small" variant="outlined" />
        <Box sx={{ flexGrow: 1 }} />
        <IconButton size="small">
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Grid container spacing={2}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={3} key={i}>
                  <Skeleton variant="rounded" height={140} />
                </Grid>
              ))
            : templates.map((t) => {
                const tags = t.tags?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
                return (
                  <Grid item xs={12} sm={6} md={3} key={t.id}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderColor: 'primary.light',
                        borderStyle: 'dashed',
                      }}
                    >
                      <CardContent sx={{ flex: 1, pb: 0.5 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {t.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          {t.description || 'No description'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          <Chip label={`${t.widgetCount} widgets`} size="small" variant="outlined" />
                          {tags.slice(0, 3).map((tag) => (
                            <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                          ))}
                        </Box>
                      </CardContent>
                      <CardActions>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ContentCopyIcon />}
                          onClick={() => onClone(t.id, t.name)}
                          fullWidth
                        >
                          Use Template
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                )
              })}
        </Grid>
      </Collapse>
    </Box>
  )
}

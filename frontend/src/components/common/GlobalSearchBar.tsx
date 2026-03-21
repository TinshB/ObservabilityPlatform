import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Autocomplete,
  TextField,
  InputAdornment,
  Box,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import type { Service } from '@/types'
import * as serviceService from '@/services/serviceService'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
const HEX_PATTERN = /^[0-9a-f]{32,}$/i

/**
 * Story 9.5 — Global search bar for the AppBar.
 * Routes input to the appropriate page:
 * - UUID/hex → trace lookup
 * - Known service name → service deep dive
 * - Otherwise → log keyword search
 */
export default function GlobalSearchBar() {
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState('')
  const [services, setServices] = useState<Service[]>([])

  useEffect(() => {
    async function loadServices() {
      try {
        const page = await serviceService.getServices({ size: 200, active: true })
        setServices(page.content)
      } catch {
        // Silently fail — search still works without autocomplete
      }
    }
    loadServices()
  }, [])

  const serviceNames = services.map((s) => s.name)

  const handleSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return

      // UUID pattern → trace lookup
      if (UUID_PATTERN.test(trimmed) || HEX_PATTERN.test(trimmed)) {
        navigate(`/traces/${encodeURIComponent(trimmed)}`)
        setInputValue('')
        return
      }

      // Known service name → service page
      const matchedService = services.find(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
      )
      if (matchedService) {
        navigate(`/services/${matchedService.id}`)
        setInputValue('')
        return
      }

      // Default → log keyword search
      navigate(`/logs?q=${encodeURIComponent(trimmed)}`)
      setInputValue('')
    },
    [navigate, services],
  )

  return (
    <Autocomplete
      freeSolo
      options={serviceNames}
      inputValue={inputValue}
      onInputChange={(_, value) => setInputValue(value)}
      onChange={(_, value) => {
        if (typeof value === 'string' && value.trim()) {
          handleSearch(value)
        }
      }}
      renderOption={(props, option) => (
        <li {...props} key={option}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">{option}</Typography>
            <Typography variant="caption" color="text.secondary">
              Service
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search traces, services, or logs..."
          size="small"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSearch(inputValue)
            }
          }}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: 200, sm: 300, md: 400 },
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255,255,255,0.5)',
              opacity: 1,
            },
          }}
        />
      )}
      sx={{ mx: 2 }}
    />
  )
}

import { useEffect, useState } from 'react'
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material'
import type { TemplateVariable, VariableOption } from '@/types/dashboard'
import { getVariableOptions } from '@/services/dashboardService'
import { useDashboardStore } from '@/store/dashboardStore'

interface Props {
  variables: TemplateVariable[]
}

export default function VariableBar({ variables }: Props) {
  const { variableValues, setVariableValue } = useDashboardStore()
  const [optionsMap, setOptionsMap] = useState<Record<string, VariableOption[]>>({})

  useEffect(() => {
    const fetchOptions = async () => {
      const uniqueTypes = [...new Set(variables.map((v) => v.type))]
      const results: Record<string, VariableOption[]> = {}

      await Promise.all(
        uniqueTypes.map(async (type) => {
          try {
            const resp = await getVariableOptions(type)
            results[type] = resp.options
          } catch {
            results[type] = []
          }
        }),
      )
      setOptionsMap(results)
    }

    if (variables.length > 0) {
      fetchOptions()
    }
  }, [variables])

  if (variables.length === 0) return null

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        alignItems: 'center',
        p: 1.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Chip label="Variables" size="small" variant="outlined" />
      {variables.map((v) => {
        const options = optionsMap[v.type] ?? []
        return (
          <FormControl key={v.name} size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{v.label}</InputLabel>
            <Select
              value={variableValues[v.name] ?? ''}
              label={v.label}
              onChange={(e) => setVariableValue(v.name, e.target.value)}
            >
              <MenuItem value="">
                <em>All</em>
              </MenuItem>
              {options.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )
      })}
    </Box>
  )
}

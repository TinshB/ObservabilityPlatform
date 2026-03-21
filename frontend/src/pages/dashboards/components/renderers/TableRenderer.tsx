import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { TimeSeries } from '@/types'
import type { WidgetOptions } from '@/types/dashboard'

interface Props {
  data: TimeSeries[]
  rawData: unknown
  options: WidgetOptions
}

export default function TableRenderer({ data, rawData, options: _options }: Props) {
  // If rawData is an array, render it directly
  if (Array.isArray(rawData) && rawData.length > 0) {
    const columns = Object.keys(rawData[0])
    return (
      <TableContainer sx={{ maxHeight: '100%', overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col} sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rawData.map((row: Record<string, unknown>, i: number) => (
              <TableRow key={i} hover>
                {columns.map((col) => (
                  <TableCell key={col} sx={{ fontSize: '0.75rem' }}>
                    {String(row[col] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  // If rawData has entries (e.g., log search response)
  const entriesData = rawData as { entries?: Record<string, unknown>[] } | null
  if (entriesData?.entries && entriesData.entries.length > 0) {
    const entries = entriesData.entries
    const columns = Object.keys(entries[0])
    return (
      <TableContainer sx={{ maxHeight: '100%', overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col} sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((row, i) => (
              <TableRow key={i} hover>
                {columns.map((col) => (
                  <TableCell key={col} sx={{ fontSize: '0.75rem' }}>
                    {typeof row[col] === 'object'
                      ? JSON.stringify(row[col])
                      : String(row[col] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  // Fallback: render time-series data as a table
  if (data.length > 0) {
    return (
      <TableContainer sx={{ maxHeight: '100%', overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Series</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Points</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Last Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((s, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ fontSize: '0.75rem' }}>{s.name}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>{s.dataPoints.length}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>
                  {s.dataPoints.length > 0
                    ? s.dataPoints[s.dataPoints.length - 1].value.toFixed(4)
                    : 'N/A'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  return (
    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
      No data available
    </Typography>
  )
}

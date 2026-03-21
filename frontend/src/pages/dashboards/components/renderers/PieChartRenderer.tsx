import React from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts'
import type { TimeSeries } from '@/types'
import type { WidgetOptions } from '@/types/dashboard'
import { CHART_COLORS } from '@/pages/metrics/chartUtils'

interface Props {
  data: TimeSeries[]
  options: WidgetOptions
}

export default function PieChartRenderer({ data, options }: Props) {
  if (!data.length) return null

  // Use the last data point of each series for pie slices
  const pieData = data
    .filter((s) => s.dataPoints.length > 0)
    .map((s) => ({
      name: s.name || 'unknown',
      value: s.dataPoints[s.dataPoints.length - 1].value,
    }))

  if (!pieData.length) return null

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="70%"
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) =>
            `${name} ${(percent * 100).toFixed(0)}%`
          }
          labelLine={false}
          fontSize={11}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {options.legend !== false && <Legend wrapperStyle={{ fontSize: 12 }} />}
      </PieChart>
    </ResponsiveContainer>
  )
}

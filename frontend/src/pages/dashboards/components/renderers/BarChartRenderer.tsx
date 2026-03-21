import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import type { TimeSeries } from '@/types'
import type { WidgetOptions } from '@/types/dashboard'
import { mergeTimeSeries, formatTime, CHART_COLORS } from '@/pages/metrics/chartUtils'

interface Props {
  data: TimeSeries[]
  options: WidgetOptions
}

export default function BarChartRenderer({ data, options }: Props) {
  if (!data.length) return null

  const names = data.map((s, i) => s.name || `series_${i}`)
  const chartData = mergeTimeSeries(data, names)
  const uniqueNames = [...new Set(names)]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="time"
          tickFormatter={formatTime}
          fontSize={11}
          tickLine={false}
        />
        <YAxis fontSize={11} tickLine={false} />
        <Tooltip
          labelFormatter={formatTime}
          contentStyle={{ fontSize: 12 }}
        />
        {options.legend !== false && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {uniqueNames.map((name, i) => (
          <Bar
            key={name}
            dataKey={name}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            stackId={options.stacked ? 'stack' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

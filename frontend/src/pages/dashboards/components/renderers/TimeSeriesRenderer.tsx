import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  Area,
  Line,
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

export default function TimeSeriesRenderer({ data, options }: Props) {
  if (!data.length) return null

  const names = data.map((s, i) => s.name || `series_${i}`)
  const chartData = mergeTimeSeries(data, names)
  const uniqueNames = [...new Set(names)]

  const sharedAxes = (
    <>
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
    </>
  )

  if (options.stacked) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          {sharedAxes}
          {uniqueNames.map((name, i) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stackId="stack"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.4}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        {sharedAxes}
        {uniqueNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

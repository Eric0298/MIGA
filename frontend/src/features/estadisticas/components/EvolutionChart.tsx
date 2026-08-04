import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Locale } from 'date-fns'
import type { DayBucket } from '@/lib/stats/period-stats'
import { formatShortDuration } from '@/features/timer/utils'

type Props = {
  data: DayBucket[]
  locale: Locale
}

/**
 * Time-per-day area chart. For long periods (>60 buckets) we thin out tick
 * labels so the axis stays readable; the tooltip still shows the exact day.
 */
function EvolutionChart({ data, locale }: Props) {
  const tickInterval = data.length > 60 ? Math.ceil(data.length / 8) : data.length > 30 ? 4 : 0
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 6" stroke="#F0E4D2" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(v: string) => format(new Date(v), 'd LLL', { locale })}
          interval={tickInterval as number | 'preserveEnd'}
          tick={{ fontSize: 11, fill: '#5A544C' }}
          tickLine={false}
          axisLine={false}
          minTickGap={12}
        />
        <YAxis
          tickFormatter={(v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)}
          tick={{ fontSize: 11, fill: '#5A544C' }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickCount={5}
        />
        <Tooltip
          cursor={{ fill: '#FFF7EC' }}
          contentStyle={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #F0E4D2',
            borderRadius: 12,
            fontSize: 12,
            padding: '8px 10px',
          }}
          formatter={(value) => [formatShortDuration(Number(value) * 60_000), '']}
          labelFormatter={(label) => format(new Date(String(label)), "d 'de' LLLL", { locale })}
          separator=""
        />
        <Area
          type="monotone"
          dataKey="minutes"
          stroke="#FF8A4C"
          strokeWidth={2.2}
          fill="#FFDCC2"
          fillOpacity={0.6}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default EvolutionChart

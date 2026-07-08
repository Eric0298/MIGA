import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Goal, Session } from '@/lib/db/schema'
import { buildProgressSeries } from '@/lib/stats/progress-series'
import { useT } from '@/i18n/i18n-context'
import { formatMinutes } from '../utils'

type GoalProgressChartProps = {
  goal: Goal
  sessions: Session[]
  todayIso: string
}

function GoalProgressChart({ goal, sessions, todayIso }: GoalProgressChartProps) {
  const { t, locale } = useT()
  const data = buildProgressSeries(goal, sessions, todayIso, locale)

  if (data.length === 0) {
    return (
      <p className="rounded-2xl bg-surface p-5 text-sm text-[color:var(--color-text-muted)]">
        {t.goalDetail.noChartData}
      </p>
    )
  }

  const xInterval = data.length <= 5 ? 0 : Math.ceil(data.length / 5) - 1
  const yTickFormatter = (v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)

  return (
    <div className="rounded-2xl bg-surface p-3">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="planFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFDCC2" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#FFDCC2" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="realFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF8A4C" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#FF8A4C" stopOpacity={0.25} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 6" stroke="#F0E4D2" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#5A544C' }}
            tickLine={false}
            axisLine={false}
            interval={xInterval}
            minTickGap={16}
            padding={{ left: 4, right: 4 }}
          />
          <YAxis
            tickFormatter={yTickFormatter}
            tick={{ fontSize: 11, fill: '#5A544C' }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickCount={4}
          />
          <Tooltip
            cursor={{ stroke: '#FF8A4C', strokeWidth: 1.5, strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #F0E4D2',
              borderRadius: 12,
              fontSize: 12,
              padding: '8px 10px',
            }}
            formatter={(value, name) => [
              formatMinutes(Number(value)),
              name === 'plan' ? t.goalDetail.plan : t.goalDetail.real,
            ]}
            labelFormatter={(label) => String(label ?? '')}
          />
          <Area
            type="monotone"
            dataKey="plan"
            stroke="#FFDCC2"
            strokeWidth={2}
            fill="url(#planFill)"
            name="plan"
            dot={false}
            activeDot={{ r: 4, fill: '#FFDCC2', stroke: '#FF8A4C', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="real"
            stroke="#FF8A4C"
            strokeWidth={2.5}
            fill="url(#realFill)"
            name="real"
            dot={false}
            activeDot={{ r: 5, fill: '#FF8A4C', stroke: '#FFFFFF', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[color:var(--color-text-muted)]">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-peach" aria-hidden="true" />
          {t.goalDetail.plan}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-apricot" aria-hidden="true" />
          {t.goalDetail.real}
        </li>
      </ul>
      <p className="mt-1 text-center text-[10px] text-[color:var(--color-text-muted)]">
        {t.goalDetail.touchHint}
      </p>
    </div>
  )
}

export default GoalProgressChart

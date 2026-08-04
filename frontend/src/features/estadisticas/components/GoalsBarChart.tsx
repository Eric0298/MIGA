import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { tpl } from '@/i18n/tpl'
import { formatShortDuration } from '@/features/timer/utils'
import type { PerGoalTime } from '@/lib/stats/period-stats'

const PALETTE = ['#FF8A4C', '#A7CDA3', '#F5C97B', '#F09999', '#7FA87B', '#E86D28']
const FREE_COLOR = '#FFDCC2'

type Props = {
  entries: PerGoalTime[]
  /** i18n template like "{percent}% del objetivo" — rendered under each bar row. */
  targetHintTemplate: string
}

/**
 * Horizontal bar chart of minutes-per-goal (top down). Uses a vertical-layout
 * BarChart so goal names get generous label space on narrow screens.
 */
function GoalsBarChart({ entries, targetHintTemplate }: Props) {
  const data = entries.map((entry, i) => ({
    label: entry.goalName,
    minutes: Math.round(entry.ms / 60_000),
    ms: entry.ms,
    color: entry.goalId === null ? FREE_COLOR : PALETTE[i % PALETTE.length],
    progressPercent: entry.progressPercent,
  }))
  const chartHeight = Math.min(360, Math.max(140, data.length * 46))
  return (
    <>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          barCategoryGap={10}
        >
          <CartesianGrid strokeDasharray="4 6" stroke="#F0E4D2" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)}
            tick={{ fontSize: 11, fill: '#5A544C' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12, fill: '#1F1F1F' }}
            tickLine={false}
            axisLine={false}
            width={110}
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
            separator=""
          />
          <Bar dataKey="minutes" radius={[6, 6, 6, 6]}>
            {data.map((row, i) => (
              <Cell key={i} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <ul className="mt-3 flex flex-col gap-1">
        {data
          .filter((row) => row.progressPercent !== null)
          .map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-2 text-xs text-[color:var(--color-text-muted)]"
            >
              <span className="flex items-center gap-2 truncate">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate">{row.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {tpl(targetHintTemplate, { percent: row.progressPercent ?? 0 })}
              </span>
            </li>
          ))}
      </ul>
    </>
  )
}

export default GoalsBarChart

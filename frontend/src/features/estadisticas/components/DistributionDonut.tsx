import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatShortDuration } from '@/features/timer/utils'
import type { PerGoalTime } from '@/lib/stats/period-stats'

const PALETTE = ['#FF8A4C', '#A7CDA3', '#F5C97B', '#F09999', '#7FA87B', '#E86D28']
const FREE_COLOR = '#FFDCC2'

type Props = {
  entries: PerGoalTime[]
}

function DistributionDonut({ entries }: Props) {
  const total = entries.reduce((sum, e) => sum + e.ms, 0)
  const data = entries.map((entry, i) => ({
    name: entry.goalName,
    ms: entry.ms,
    minutes: Math.round(entry.ms / 60_000),
    color: entry.goalId === null ? FREE_COLOR : PALETTE[i % PALETTE.length],
    percent: total === 0 ? 0 : Math.round((entry.ms / total) * 100),
  }))
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="ms"
            nameKey="name"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #F0E4D2',
              borderRadius: 12,
              fontSize: 12,
              padding: '8px 10px',
            }}
            formatter={(value, _name, item) => {
              const payloadName = ((item?.payload ?? {}) as { name?: string }).name ?? ''
              return [formatShortDuration(Number(value)), payloadName]
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex flex-col gap-2">
        {data.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 truncate text-charcoal">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate">{row.name}</span>
            </span>
            <span className="shrink-0 text-xs text-[color:var(--color-text-muted)] tabular-nums">
              {row.percent}% · {formatShortDuration(row.ms)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DistributionDonut

import { format } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fromIso } from '@/features/goals/utils'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import type { ExamScorePoint } from '@/lib/stats/sessions-stats'

type ExamScoreEvolutionChartProps = {
  points: ExamScorePoint[]
  color: string
  height?: number
}

function ExamScoreEvolutionChart({
  points,
  color,
  height = 140,
}: ExamScoreEvolutionChartProps) {
  const { t, locale } = useT()

  if (points.length === 0) {
    return (
      <p className="text-xs text-[color:var(--color-text-muted)]">
        {t.stats.examScoreNoData}
      </p>
    )
  }

  const data = points.map((p, index) => ({
    index,
    percent: p.percent,
    label: format(fromIso(p.day), 'd LLL', { locale }),
    title: p.title,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 6" stroke="#F0E4D2" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#5A544C' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 10, fill: '#5A544C' }}
          tickLine={false}
          axisLine={false}
          width={40}
          tickCount={5}
        />
        <Tooltip
          cursor={{ stroke: '#F0E4D2' }}
          contentStyle={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #F0E4D2',
            borderRadius: 12,
            fontSize: 12,
            padding: '8px 10px',
          }}
          formatter={(value) => [tpl(t.stats.examScorePercent, { percent: Number(value) }), '']}
          labelFormatter={(_label, payload) => {
            const item = payload?.[0]?.payload as { title?: string; label?: string } | undefined
            if (item?.title && item?.label) return `${item.label} · ${item.title}`
            return String(_label ?? '')
          }}
        />
        <Line
          type="monotone"
          dataKey="percent"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, stroke: color, strokeWidth: 2, fill: '#FFFFFF' }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default ExamScoreEvolutionChart

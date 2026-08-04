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
import type { Locale } from 'date-fns'
import type { ExamScore } from '@/lib/stats/period-stats'

type Props = {
  points: ExamScore[]
  locale: Locale
}

function ExamsEvolutionChart({ points, locale }: Props) {
  const data = points.map((p) => ({
    day: p.day,
    percent: p.percent,
    title: p.title,
  }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 6" stroke="#F0E4D2" vertical={false} />
        <XAxis
          dataKey="day"
          tickFormatter={(v: string) => format(new Date(v), 'd LLL', { locale })}
          tick={{ fontSize: 11, fill: '#5A544C' }}
          tickLine={false}
          axisLine={false}
          minTickGap={16}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11, fill: '#5A544C' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #F0E4D2',
            borderRadius: 12,
            fontSize: 12,
            padding: '8px 10px',
          }}
          formatter={(value, _name, item) => {
            const title = ((item?.payload ?? {}) as { title?: string }).title ?? ''
            return [`${value}%`, title]
          }}
          labelFormatter={(label) => format(new Date(String(label)), "d 'de' LLLL", { locale })}
        />
        <Line
          type="monotone"
          dataKey="percent"
          stroke="#A7CDA3"
          strokeWidth={2.4}
          dot={{ r: 3, fill: '#A7CDA3', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default ExamsEvolutionChart

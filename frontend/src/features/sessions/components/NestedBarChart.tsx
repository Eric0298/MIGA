import { clsx } from 'clsx'
import { formatShortDuration } from '@/features/timer/utils'

export type NestedSegment = {
  key: string
  name: string
  color: string
  minutes: number
}

export type NestedDay = {
  label: string
  segments: NestedSegment[]
}

type NestedBarChartProps = {
  data: NestedDay[]
  height?: number
  todayIndex?: number
}

const BASE_WIDTH_PERCENT = 72
const REDUCTION_PER_LAYER = 12
const MIN_WIDTH_PERCENT = 22

function NestedBarChart({ data, height = 200, todayIndex }: NestedBarChartProps) {
  const maxMinutes = Math.max(1, ...data.flatMap((day) => day.segments.map((seg) => seg.minutes)))
  const barsAreaHeight = height - 28

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-7 gap-1" style={{ height: `${barsAreaHeight}px` }}>
        {data.map((day, dayIndex) => {
          const isToday = dayIndex === todayIndex
          const sorted = [...day.segments].sort((a, b) => b.minutes - a.minutes)
          return (
            <div
              key={dayIndex}
              className={clsx(
                'relative flex items-end justify-center rounded-md',
                isToday && 'bg-cream',
              )}
            >
              {sorted.map((segment, layerIndex) => {
                const widthPercent = Math.max(
                  MIN_WIDTH_PERCENT,
                  BASE_WIDTH_PERCENT - layerIndex * REDUCTION_PER_LAYER,
                )
                const heightPercent = (segment.minutes / maxMinutes) * 100
                return (
                  <div
                    key={segment.key}
                    role="img"
                    aria-label={`${day.label} · ${segment.name}: ${formatShortDuration(
                      segment.minutes * 60_000,
                    )}`}
                    title={`${segment.name}: ${formatShortDuration(segment.minutes * 60_000)}`}
                    className="absolute bottom-0 rounded-t-md transition-all"
                    style={{
                      width: `${widthPercent}%`,
                      height: `${heightPercent}%`,
                      backgroundColor: segment.color,
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {data.map((day, dayIndex) => (
          <span
            key={dayIndex}
            className={clsx(
              'text-xs',
              dayIndex === todayIndex
                ? 'font-semibold text-charcoal'
                : 'text-[color:var(--color-text-muted)]',
            )}
          >
            {day.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default NestedBarChart

import { useMemo, useState } from 'react'
import { format, startOfWeek, subDays } from 'date-fns'
import { clsx } from 'clsx'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import type { ExamAttempt, Goal, Session } from '@/lib/db/schema'
import { getElapsedMs } from '@/features/timer/utils'
import { getExamElapsedMs } from '@/lib/db/exam-attempts.repository'
import { toLocalIsoDay } from '@/lib/stats/sessions-stats'
import { formatShortDuration } from '@/features/timer/utils'

const HEATMAP_WEEKS = 26
const DAYS_IN_WEEK = 7

type CellData = {
  day: string
  minutes: number
  sessions: number
  goalMinutes: Map<string | null, number>
}

type Props = {
  sessions: Session[]
  exams: ExamAttempt[]
  goals: Goal[]
}

type GoalFilter = 'all' | string

/**
 * MIGA-flavoured GitHub-style contribution grid. Each cell is a local calendar
 * day and its shade encodes the amount of time studied that day (either total
 * or filtered by goal). Levels are 0..4 and mapped to Cream → Peach → Apricot
 * so it stays on-brand and readable in the current theme.
 */
function GoalsHeatmap({ sessions, exams, goals }: Props) {
  const { t, locale } = useT()
  const [filter, setFilter] = useState<GoalFilter>('all')
  const [hover, setHover] = useState<CellData | null>(null)

  const now = useMemo(() => new Date(), [])
  const gridStart = useMemo(() => {
    const weeksBackStart = subDays(now, (HEATMAP_WEEKS - 1) * 7)
    return startOfWeek(weeksBackStart, { weekStartsOn: 1 })
  }, [now])
  const gridStartMs = gridStart.getTime()

  const cellsByDay = useMemo(() => {
    const map = new Map<string, CellData>()
    for (const s of sessions) {
      if (s.status !== 'completed' || s.endedAt === null) continue
      if (s.endedAt < gridStartMs) continue
      const day = toLocalIsoDay(s.endedAt)
      const entry = map.get(day) ?? { day, minutes: 0, sessions: 0, goalMinutes: new Map() }
      const minutes = Math.round(getElapsedMs(s) / 60_000)
      entry.minutes += minutes
      entry.sessions += 1
      const key = s.goalId
      entry.goalMinutes.set(key, (entry.goalMinutes.get(key) ?? 0) + minutes)
      map.set(day, entry)
    }
    for (const a of exams) {
      if (a.endedAt === null) continue
      if (a.status === 'discarded' || a.status === 'in-progress' || a.status === 'paused') continue
      if (a.endedAt < gridStartMs) continue
      const day = toLocalIsoDay(a.endedAt)
      const entry = map.get(day) ?? { day, minutes: 0, sessions: 0, goalMinutes: new Map() }
      const minutes = Math.round(getExamElapsedMs(a) / 60_000)
      entry.minutes += minutes
      entry.sessions += 1
      entry.goalMinutes.set(a.goalId, (entry.goalMinutes.get(a.goalId) ?? 0) + minutes)
      map.set(day, entry)
    }
    return map
  }, [sessions, exams, gridStartMs])

  const columns = useMemo(() => {
    const cols: Array<{
      isoStart: string
      days: Array<{ day: string; date: Date; inFuture: boolean }>
    }> = []
    const cursor = new Date(gridStart)
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const days: Array<{ day: string; date: Date; inFuture: boolean }> = []
      const isoStart = toLocalIsoDay(cursor.getTime())
      for (let d = 0; d < DAYS_IN_WEEK; d++) {
        const date = new Date(cursor)
        days.push({
          day: toLocalIsoDay(date.getTime()),
          date,
          inFuture: date.getTime() > now.getTime(),
        })
        cursor.setDate(cursor.getDate() + 1)
      }
      cols.push({ isoStart, days })
    }
    return cols
  }, [gridStart, now])

  const filteredMinutesFor = (cell: CellData | undefined): number => {
    if (!cell) return 0
    if (filter === 'all') return cell.minutes
    return cell.goalMinutes.get(filter) ?? 0
  }

  const maxMinutes = useMemo(() => {
    let max = 0
    for (const cell of cellsByDay.values()) {
      const m = filteredMinutesFor(cell)
      if (m > max) max = m
    }
    return max
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellsByDay, filter])

  const goalOptions = useMemo(
    () => [...goals].sort((a, b) => a.name.localeCompare(b.name, locale.code)),
    [goals, locale.code],
  )

  const monthLabels = buildMonthLabels(columns, t.estadisticas.heatmap.months)

  const summary = useMemo(
    () => buildSummary(cellsByDay, goals, gridStartMs, now.getTime(), t.common.freeSession),
    [cellsByDay, goals, gridStartMs, now, t.common.freeSession],
  )

  return (
    <section aria-labelledby="heatmap-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="heatmap-title" className="text-base font-semibold text-charcoal">
          {t.estadisticas.heatmap.title}
        </h2>
        <p className="text-xs text-[color:var(--color-text-muted)]">
          {t.estadisticas.heatmap.subtitle}
        </p>
      </div>

      <div
        role="tablist"
        aria-label={t.estadisticas.heatmap.selectorLabel}
        className="-mx-1 flex overflow-x-auto px-1 pb-1"
      >
        <div className="flex shrink-0 gap-2">
          <FilterChip
            active={filter === 'all'}
            label={t.estadisticas.heatmap.allGoals}
            onClick={() => setFilter('all')}
          />
          {goalOptions.map((g) => (
            <FilterChip
              key={g.id}
              active={filter === g.id}
              label={g.name}
              onClick={() => setFilter(g.id)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-surface p-4">
        {maxMinutes === 0 ? (
          <p className="py-6 text-center text-sm text-[color:var(--color-text-muted)]">
            {t.estadisticas.heatmap.empty}
          </p>
        ) : (
          <div className="relative">
            <div className="overflow-x-auto pb-2">
              <div className="inline-flex flex-col gap-2">
                <MonthAxis labels={monthLabels} />
                <div className="flex gap-1">
                  <WeekdayAxis labels={t.estadisticas.heatmap.weekdays} />
                  <div className="flex gap-[3px]">
                    {columns.map((col) => (
                      <div key={col.isoStart} className="flex flex-col gap-[3px]">
                        {col.days.map(({ day, date, inFuture }) => {
                          const cell = cellsByDay.get(day)
                          const minutes = filteredMinutesFor(cell)
                          const level = intensityLevel(minutes, maxMinutes)
                          return (
                            <button
                              key={day}
                              type="button"
                              disabled={inFuture}
                              onMouseEnter={() =>
                                setHover(
                                  cell ?? { day, minutes: 0, sessions: 0, goalMinutes: new Map() },
                                )
                              }
                              onMouseLeave={() => setHover(null)}
                              onFocus={() =>
                                setHover(
                                  cell ?? { day, minutes: 0, sessions: 0, goalMinutes: new Map() },
                                )
                              }
                              onBlur={() => setHover(null)}
                              aria-label={buildAriaLabel(t, locale, date, minutes)}
                              className={clsx(
                                'h-3 w-3 shrink-0 rounded-[3px] transition-colors focus:outline-none focus:ring-2 focus:ring-apricot',
                                inFuture && 'opacity-0 pointer-events-none',
                                cellClassForLevel(level),
                              )}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <Legend
              lessLabel={t.estadisticas.heatmap.lessLabel}
              moreLabel={t.estadisticas.heatmap.moreLabel}
            />

            {hover && (
              <div className="mt-3 rounded-xl bg-cream px-3 py-2 text-xs text-charcoal">
                <p className="font-semibold">
                  {tpl(t.estadisticas.heatmap.tooltipDate, {
                    date: format(new Date(hover.day), "d 'de' LLLL yyyy", { locale }),
                  })}
                </p>
                {hover.minutes > 0 ? (
                  <p className="text-[color:var(--color-text-muted)]">
                    {tpl(t.estadisticas.heatmap.tooltipMinutes, { minutes: hover.minutes })} ·{' '}
                    {hover.sessions === 1
                      ? tpl(t.estadisticas.heatmap.tooltipSessions, { count: hover.sessions })
                      : tpl(t.estadisticas.heatmap.tooltipSessionsOther, { count: hover.sessions })}
                  </p>
                ) : (
                  <p className="text-[color:var(--color-text-muted)]">
                    {t.estadisticas.heatmap.tooltipNoActivity}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          label={t.estadisticas.heatmap.summaryActiveDays}
          value={summary.activeDays.toString()}
        />
        <SummaryCard
          label={t.estadisticas.heatmap.summaryBestStreak}
          value={summary.bestStreak.toString()}
        />
        <SummaryCard
          label={t.estadisticas.heatmap.summaryBestDay}
          value={summary.bestDay ? formatShortDuration(summary.bestDayMinutes * 60_000) : '—'}
          hint={
            summary.bestDay
              ? format(new Date(summary.bestDay), "d 'de' LLL", { locale })
              : undefined
          }
        />
        <SummaryCard
          label={t.estadisticas.heatmap.summaryTopGoal}
          value={summary.topGoalName ?? '—'}
        />
      </div>
    </section>
  )
}

function intensityLevel(minutes: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes === 0 || max === 0) return 0
  const ratio = minutes / max
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function cellClassForLevel(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 0:
      return 'bg-[color:var(--color-border)]'
    case 1:
      return 'bg-peach'
    case 2:
      return 'bg-[#F8B47A]'
    case 3:
      return 'bg-apricot'
    case 4:
      return 'bg-[#D5601B]'
  }
}

function WeekdayAxis({ labels }: { labels: readonly string[] }) {
  return (
    <div className="flex flex-col gap-[3px] pr-1">
      {labels.map((label, i) => (
        <span
          key={`${label}-${i}`}
          className={clsx(
            'h-3 text-[9px] leading-3 text-[color:var(--color-text-muted)]',
            i % 2 === 0 ? 'opacity-100' : 'opacity-0',
          )}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function MonthAxis({ labels }: { labels: Array<{ colIndex: number; label: string }> }) {
  return (
    <div className="relative ml-5 h-3">
      {labels.map(({ colIndex, label }) => (
        <span
          key={`${colIndex}-${label}`}
          className="absolute text-[10px] leading-3 text-[color:var(--color-text-muted)]"
          style={{ left: `${colIndex * 15}px` }}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

function Legend({ lessLabel, moreLabel }: { lessLabel: string; moreLabel: string }) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-[11px] text-[color:var(--color-text-muted)]">{lessLabel}</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <span
          key={level}
          aria-hidden="true"
          className={clsx('h-3 w-3 rounded-[3px]', cellClassForLevel(level as 0 | 1 | 2 | 3 | 4))}
        />
      ))}
      <span className="text-[11px] text-[color:var(--color-text-muted)]">{moreLabel}</span>
    </div>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        'inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-charcoal text-white'
          : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
      )}
    >
      {label}
    </button>
  )
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-base font-semibold text-charcoal truncate">{value}</p>
      {hint && (
        <p className="mt-1 text-[11px] text-[color:var(--color-text-muted)] truncate">{hint}</p>
      )}
    </div>
  )
}

function buildMonthLabels(
  columns: Array<{ isoStart: string; days: Array<{ date: Date }> }>,
  months: Record<string, string>,
): Array<{ colIndex: number; label: string }> {
  const abbr = [
    months.jan,
    months.feb,
    months.mar,
    months.apr,
    months.may,
    months.jun,
    months.jul,
    months.aug,
    months.sep,
    months.oct,
    months.nov,
    months.dec,
  ]
  const labels: Array<{ colIndex: number; label: string }> = []
  let previousMonth = -1
  columns.forEach((col, index) => {
    const firstDay = col.days[0].date
    const month = firstDay.getMonth()
    if (month !== previousMonth && firstDay.getDate() <= 7) {
      labels.push({ colIndex: index, label: abbr[month] ?? '' })
      previousMonth = month
    }
  })
  return labels
}

type Summary = {
  activeDays: number
  bestStreak: number
  bestDay: string | null
  bestDayMinutes: number
  topGoalName: string | null
}

function buildSummary(
  cellsByDay: Map<string, CellData>,
  goals: Goal[],
  startMs: number,
  endMs: number,
  freeLabel: string,
): Summary {
  let activeDays = 0
  let bestDay: string | null = null
  let bestDayMinutes = 0
  const goalTotals = new Map<string | null, number>()
  const activeDaySet = new Set<string>()
  for (const cell of cellsByDay.values()) {
    if (cell.minutes > 0) {
      activeDays += 1
      activeDaySet.add(cell.day)
    }
    if (cell.minutes > bestDayMinutes) {
      bestDayMinutes = cell.minutes
      bestDay = cell.day
    }
    for (const [goalId, minutes] of cell.goalMinutes) {
      goalTotals.set(goalId, (goalTotals.get(goalId) ?? 0) + minutes)
    }
  }
  let topGoalName: string | null = null
  let topGoalMinutes = 0
  for (const [goalId, minutes] of goalTotals) {
    if (minutes <= topGoalMinutes) continue
    topGoalMinutes = minutes
    topGoalName = goalId === null ? freeLabel : (goals.find((g) => g.id === goalId)?.name ?? '—')
  }
  const bestStreak = computeBestStreak(activeDaySet, startMs, endMs)
  return { activeDays, bestStreak, bestDay, bestDayMinutes, topGoalName }
}

function computeBestStreak(activeDays: Set<string>, startMs: number, endMs: number): number {
  if (activeDays.size === 0) return 0
  let best = 0
  let current = 0
  const cursor = new Date(startMs)
  cursor.setHours(0, 0, 0, 0)
  while (cursor.getTime() <= endMs) {
    const day = toLocalIsoDay(cursor.getTime())
    if (activeDays.has(day)) {
      current += 1
      if (current > best) best = current
    } else {
      current = 0
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return best
}

function buildAriaLabel(
  t: ReturnType<typeof useT>['t'],
  locale: ReturnType<typeof useT>['locale'],
  date: Date,
  minutes: number,
): string {
  const dateLabel = format(date, "d 'de' LLLL", { locale })
  if (minutes === 0) return `${dateLabel} · ${t.estadisticas.heatmap.tooltipNoActivity}`
  return `${dateLabel} · ${tpl(t.estadisticas.heatmap.tooltipMinutes, { minutes })}`
}

export default GoalsHeatmap

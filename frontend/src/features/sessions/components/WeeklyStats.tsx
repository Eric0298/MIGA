import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Flame } from 'lucide-react'
import { clsx } from 'clsx'
import { formatShortDuration } from '@/features/timer/utils'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { toLocalIsoDay } from '@/lib/stats/sessions-stats'
import {
  FREE_SESSION_KEY,
  getCurrentStreakDays,
  getWeekActiveGoalKeys,
  getWeekGoalRanking,
  getWeekStackedDailyMs,
  sumPreviousWeekMs,
  sumWeekMs,
  type GoalKey,
} from '@/lib/stats/weekly-stats'
import type { Goal, Session } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import EmptyState from '@/components/ui/EmptyState'
import NestedBarChart, { type NestedDay } from './NestedBarChart'

type WeeklyStatsProps = {
  sessions: Session[]
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
const GOAL_PALETTE = ['#FF8A4C', '#A7CDA3', '#F5C97B', '#F09999', '#7FA87B', '#E86D28']
const FREE_COLOR = '#FFDCC2'

function colorFor(key: GoalKey, keys: readonly GoalKey[]): string {
  if (key === FREE_SESSION_KEY) return FREE_COLOR
  const goalKeys = keys.filter((k) => k !== FREE_SESSION_KEY)
  const index = goalKeys.indexOf(key)
  return GOAL_PALETTE[index % GOAL_PALETTE.length]
}

function nameFor(key: GoalKey, goals: Goal[] | undefined, freeLabel: string): string {
  if (key === FREE_SESSION_KEY) return freeLabel
  return goals?.find((g) => g.id === key)?.name ?? '—'
}

function WeeklyStats({ sessions }: WeeklyStatsProps) {
  const { t } = useT()
  const goals = useLiveGoals()
  const now = useMemo(() => new Date(), [])
  const today = toLocalIsoDay(now.getTime())
  const todayIndex = (now.getDay() + 6) % 7

  const [selectedGoal, setSelectedGoal] = useState<GoalKey | null>(null)

  const weekMs = useMemo(() => sumWeekMs(sessions, now), [sessions, now])
  const previousWeekMs = useMemo(() => sumPreviousWeekMs(sessions, now), [sessions, now])
  const activeKeys = useMemo(() => getWeekActiveGoalKeys(sessions, now), [sessions, now])
  const stackedData = useMemo(
    () => getWeekStackedDailyMs(sessions, now, activeKeys, DAY_LABELS),
    [sessions, now, activeKeys],
  )
  const nestedKeys = useMemo<readonly GoalKey[]>(
    () => (selectedGoal === null ? activeKeys : [selectedGoal]),
    [selectedGoal, activeKeys],
  )
  const nestedData = useMemo<NestedDay[]>(
    () =>
      stackedData.map((row) => ({
        label: String(row.label),
        segments: nestedKeys
          .map((key) => ({
            key: String(key),
            name: nameFor(key, goals, t.stats.freeSessionsChip),
            color: colorFor(key, activeKeys),
            minutes: (row[key] as number | undefined) ?? 0,
          }))
          .filter((s) => s.minutes > 0),
      })),
    [stackedData, nestedKeys, goals, activeKeys, t.stats.freeSessionsChip],
  )
  const ranking = useMemo(() => getWeekGoalRanking(sessions, now).slice(0, 3), [sessions, now])
  const streak = useMemo(() => getCurrentStreakDays(sessions, today), [sessions, today])

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={<Flame size={20} aria-hidden="true" />}
        title={t.stats.emptyTitle}
        description={t.stats.emptyDescription}
      />
    )
  }

  const deltaText = renderDelta(t, weekMs, previousWeekMs)
  const streakText =
    streak === 0
      ? t.stats.noStreak
      : streak === 1
        ? tpl(t.stats.streakDaysOne, { count: streak })
        : tpl(t.stats.streakDaysOther, { count: streak })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface p-5">
          <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
            {t.stats.thisWeek}
          </p>
          <p className="mt-2 text-2xl font-bold text-charcoal tabular-nums">
            {formatShortDuration(weekMs)}
          </p>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{deltaText}</p>
        </div>
        <div className="rounded-2xl bg-surface p-5">
          <div className="flex items-center gap-1.5">
            <Flame
              size={14}
              className={streak > 0 ? 'text-apricot' : 'text-[color:var(--color-text-muted)]'}
              aria-hidden="true"
            />
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              {t.stats.streak}
            </p>
          </div>
          <p className="mt-2 text-2xl font-bold text-charcoal tabular-nums">{streak}</p>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{streakText}</p>
        </div>
      </div>

      {activeKeys.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal">{t.stats.dailyBreakdown}</p>
            <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
              {t.stats.filterByGoal}
            </p>
          </div>
          <div
            role="tablist"
            aria-label={t.stats.filterByGoal}
            className="-mx-1 flex overflow-x-auto px-1 pb-1"
          >
            <div className="flex shrink-0 gap-2">
              <FilterChip
                active={selectedGoal === null}
                label={t.stats.allGoals}
                color="#FF8A4C"
                onClick={() => setSelectedGoal(null)}
              />
              {activeKeys.map((key) => (
                <FilterChip
                  key={key}
                  active={selectedGoal === key}
                  label={nameFor(key, goals, t.stats.freeSessionsChip)}
                  color={colorFor(key, activeKeys)}
                  onClick={() => setSelectedGoal(key)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-surface p-4">
            <NestedBarChart data={nestedData} height={200} todayIndex={todayIndex} />
          </div>
        </section>
      )}

      {ranking.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-charcoal">{t.stats.topGoals}</h3>
          <ul className="flex flex-col gap-2">
            {ranking.map((entry) => {
              const goal = goals?.find((g) => g.id === entry.goalId)
              const name = goal?.name ?? '—'
              const color = colorFor(entry.goalId, activeKeys)
              return (
                <li
                  key={entry.goalId}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium text-charcoal">{name}</p>
                  </div>
                  <p className="text-sm font-semibold text-charcoal tabular-nums">
                    {formatShortDuration(entry.ms)}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {activeKeys.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium text-charcoal">{t.stats.weekOverview}</p>
            <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
              {t.stats.weekOverviewHint}
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stackedData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 6" stroke="#F0E4D2" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#5A544C' }}
                  tickLine={false}
                  axisLine={false}
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
                  formatter={(value, name) => [
                    formatShortDuration(Number(value) * 60_000),
                    nameFor(String(name) as GoalKey, goals, t.stats.freeSessionsChip),
                  ]}
                  labelFormatter={(label) => String(label ?? '')}
                />
                <Legend
                  formatter={(value) =>
                    nameFor(String(value) as GoalKey, goals, t.stats.freeSessionsChip)
                  }
                  wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                  iconType="circle"
                />
                {activeKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="week"
                    fill={colorFor(key, activeKeys)}
                    radius={i === activeKeys.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  )
}

type FilterChipProps = {
  active: boolean
  label: string
  color: string
  onClick: () => void
}

function FilterChip({ active, label, color, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-charcoal text-white'
          : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
      )}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </button>
  )
}

function renderDelta(t: ReturnType<typeof useT>['t'], current: number, previous: number): string {
  if (previous === 0) return t.stats.noPreviousData
  const rawPercent = ((current - previous) / previous) * 100
  const rounded = Math.round(rawPercent)
  if (rounded === 0) return t.stats.vsPreviousSame
  if (rounded > 0) return tpl(t.stats.vsPreviousWeekUp, { percent: rounded })
  return tpl(t.stats.vsPreviousWeekDown, { percent: rounded })
}

export default WeeklyStats

import { CalendarClock, Flame, ListChecks, Play, Sparkles, TimerReset } from 'lucide-react'
import { Link } from 'react-router'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import EmptyState from '@/components/ui/EmptyState'
import { useActiveSession } from '@/features/timer/hooks/use-active-session'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { useAllExamAttempts } from '@/features/exams/hooks/use-all-exam-attempts'
import ActiveExamAttemptsBanner from '@/features/exams/components/ActiveExamAttemptsBanner'
import PendingGradeExamsBanner from '@/features/exams/components/PendingGradeExamsBanner'
import { formatShortDuration, getElapsedMs } from '@/features/timer/utils'
import { formatDayRelative } from '@/features/goals/utils'
import { filterCompletedByDay, sumElapsedMs, toLocalIsoDay } from '@/lib/stats/sessions-stats'
import { computeGoalStatus, type GoalStatus } from '@/lib/stats/goal-status'
import { findNextPlannedDay } from '@/lib/stats/upcoming'
import { getCurrentStreakDays } from '@/lib/stats/weekly-stats'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import type { Messages } from '@/i18n/messages/es'

const RECENT_SESSIONS_LIMIT = 5

function HomePage() {
  const { t, locale } = useT()
  const active = useActiveSession()
  const sessions = useCompletedSessions()
  const goals = useLiveGoals()
  const examAttempts = useAllExamAttempts()
  const isLoading = active === undefined || sessions === undefined || goals === undefined

  const today = toLocalIsoDay(Date.now())
  const todaySessions = sessions ? filterCompletedByDay(sessions, today) : []
  const todayMs = sumElapsedMs(todaySessions)
  const recentSessions = sessions?.slice(0, RECENT_SESSIONS_LIMIT) ?? []
  const nextPlanned = goals ? findNextPlannedDay(goals, today) : null
  const streakDays = sessions ? getCurrentStreakDays(sessions, today, examAttempts ?? []) : 0

  const raw = format(new Date(), "EEEE d 'de' LLLL", { locale })
  const todayLabel = raw.charAt(0).toUpperCase() + raw.slice(1)
  const relativeLabels = {
    today: t.calendar.legendToday,
    tomorrow: t.calendar.tomorrow,
    yesterday: t.calendar.yesterday,
  }
  const activeGoalName = active
    ? (goals?.find((g) => g.id === active.goalId)?.name ?? t.common.freeSession)
    : null

  const streakLabel = streakLabelFor(t, streakDays)
  const nextPlannedLabel = nextPlanned
    ? formatDayRelative(nextPlanned.day, today, locale, relativeLabels)
    : null

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <header>
        <h1 className="text-2xl font-bold text-charcoal lg:text-3xl">{t.home.title}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{todayLabel}</p>
      </header>

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      <ActiveExamAttemptsBanner />
      <PendingGradeExamsBanner />

      {!isLoading && active && (
        <Link
          to="/app/timer"
          className="flex items-center justify-between gap-3 rounded-2xl bg-apricot p-5 text-white lg:p-6"
        >
          <div>
            <p className="text-xs font-medium opacity-90">
              {active.status === 'paused' ? t.home.pausedSession : t.home.activeSession}
            </p>
            <p className="mt-0.5 text-base font-semibold lg:text-lg">{activeGoalName}</p>
          </div>
          <Play size={20} aria-hidden="true" />
        </Link>
      )}

      {!isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
          <KpiCard
            icon={<TimerReset size={18} aria-hidden="true" />}
            label={t.home.today}
            value={formatShortDuration(todayMs)}
          />
          <KpiCard
            icon={<ListChecks size={18} aria-hidden="true" />}
            label={t.home.sessionsKpi}
            value={String(todaySessions.length)}
          />
          <KpiCard
            className="hidden lg:flex"
            icon={<Flame size={18} aria-hidden="true" />}
            label={t.stats.streak}
            value={streakDays === 0 ? '—' : String(streakDays)}
            hint={streakLabel}
            accent={streakDays > 0 ? 'apricot' : 'muted'}
          />
          <KpiCard
            className="hidden lg:flex"
            icon={<CalendarClock size={18} aria-hidden="true" />}
            label={t.home.nextPlanned}
            value={nextPlannedLabel ?? '—'}
            hint={nextPlanned ? nextPlanned.goal.name : t.calendar.legendPlanned}
            to={nextPlanned ? `/app/metas/${nextPlanned.goal.id}` : undefined}
          />
        </div>
      )}

      {!isLoading && nextPlanned && (
        <Link
          to={`/app/metas/${nextPlanned.goal.id}`}
          className="flex items-center gap-3 rounded-2xl bg-surface p-4 lg:hidden"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-peach text-charcoal">
            <CalendarClock size={18} aria-hidden="true" />
          </span>
          <div className="flex-1">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              {t.home.nextPlanned}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-charcoal">
              {formatDayRelative(nextPlanned.day, today, locale, relativeLabels)} ·{' '}
              {nextPlanned.goal.name}
            </p>
          </div>
        </Link>
      )}

      {!isLoading && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-8">
          {goals && goals.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-charcoal lg:text-base">{t.home.yourGoals}</h2>
              <ul className="mt-3 flex flex-col gap-2 lg:gap-3">
                {goals.map((g) => {
                  const info = computeGoalStatus(g, sessions ?? [], today, examAttempts ?? [])
                  const percent = percentFor(info.actualMs, g.targetMinutes)
                  return (
                    <li key={g.id}>
                      <Link
                        to={`/app/metas/${g.id}`}
                        className="flex flex-col gap-3 rounded-2xl bg-surface px-4 py-3 transition-colors hover:bg-peach/30 lg:px-5 lg:py-4"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={clsx(
                              'h-2.5 w-2.5 shrink-0 rounded-full',
                              dotClass(info.status),
                            )}
                            aria-hidden="true"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-charcoal lg:text-base">
                              {g.name}
                            </p>
                            <p className="text-xs text-[color:var(--color-text-muted)]">
                              {statusLabel(t.goalStatus, info.status, info.actualMs, g.targetMinutes)}
                            </p>
                          </div>
                          <p className="hidden text-sm font-bold text-charcoal tabular-nums lg:block">
                            {percent}%
                          </p>
                        </div>
                        <div
                          className="hidden h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-border)] lg:block"
                          aria-hidden="true"
                        >
                          <div
                            className={clsx(
                              'h-full rounded-full transition-[width]',
                              barClass(info.status),
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {recentSessions.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-charcoal lg:text-base">
                {t.home.recentSessions}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {recentSessions.map((s) => {
                  const name = s.goalId
                    ? (goals?.find((g) => g.id === s.goalId)?.name ?? t.common.freeSession)
                    : t.common.freeSession
                  const day = s.endedAt ? toLocalIsoDay(s.endedAt) : ''
                  const dayLabel = day
                    ? formatDayRelative(day, today, locale, relativeLabels)
                    : ''
                  const timeLabel = s.endedAt ? format(new Date(s.endedAt), 'HH:mm') : ''
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-charcoal">{name}</p>
                        <p className="text-xs text-[color:var(--color-text-muted)]">
                          {dayLabel} · {timeLabel}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-charcoal tabular-nums">
                        {formatShortDuration(getElapsedMs(s))}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      {!isLoading && !active && recentSessions.length === 0 && (goals?.length ?? 0) === 0 && (
        <EmptyState
          icon={<Sparkles size={20} aria-hidden="true" />}
          title={t.home.emptyTitle}
          description={t.home.emptyDescription}
          action={
            <Link
              to="/app/timer"
              className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
            >
              {t.home.startSession}
            </Link>
          }
        />
      )}
    </div>
  )
}

type KpiAccent = 'default' | 'apricot' | 'muted'

type KpiCardProps = {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  accent?: KpiAccent
  className?: string
  to?: string
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent = 'default',
  className,
  to,
}: KpiCardProps) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            'hidden h-8 w-8 items-center justify-center rounded-xl lg:inline-flex',
            accent === 'apricot' ? 'bg-apricot/15 text-apricot' : 'bg-peach text-charcoal',
          )}
        >
          {icon}
        </span>
        <p className="text-xs font-medium text-[color:var(--color-text-muted)]">{label}</p>
      </div>
      <p
        className={clsx(
          'text-2xl font-bold tabular-nums lg:text-3xl',
          accent === 'muted' ? 'text-[color:var(--color-text-muted)]' : 'text-charcoal',
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="text-xs text-[color:var(--color-text-muted)] truncate">{hint}</p>
      )}
    </>
  )

  const shared = clsx(
    'flex flex-col gap-2 rounded-2xl bg-surface p-5 lg:gap-3 lg:p-6',
    to && 'transition-colors hover:bg-peach/30',
    className,
  )

  if (to) {
    return (
      <Link to={to} className={shared}>
        {inner}
      </Link>
    )
  }
  return <div className={shared}>{inner}</div>
}

function percentFor(actualMs: number, targetMinutes: number): number {
  if (targetMinutes <= 0) return 0
  return Math.min(100, Math.round((actualMs / 60_000 / targetMinutes) * 100))
}

function dotClass(status: GoalStatus): string {
  if (status === 'behind') return 'bg-apricot'
  if (status === 'not-started') return 'bg-[color:var(--color-border)]'
  return 'bg-pistachio'
}

function barClass(status: GoalStatus): string {
  if (status === 'behind') return 'bg-apricot'
  if (status === 'not-started') return 'bg-[color:var(--color-border)]'
  return 'bg-pistachio'
}

function statusLabel(
  goalStatusMessages: Messages['goalStatus'],
  status: GoalStatus,
  actualMs: number,
  targetMinutes: number,
): string {
  const percent = percentFor(actualMs, targetMinutes)
  if (status === 'not-started') return goalStatusMessages.notStarted
  if (status === 'complete') return goalStatusMessages.complete
  if (status === 'ahead') return tpl(goalStatusMessages.ahead, { percent })
  if (status === 'on-track') return tpl(goalStatusMessages.onTrack, { percent })
  return tpl(goalStatusMessages.behind, { percent })
}

function streakLabelFor(t: Messages, days: number): string {
  if (days === 0) return t.stats.noStreak
  const template = days === 1 ? t.stats.streakDaysOne : t.stats.streakDaysOther
  return tpl(template, { count: days })
}

export default HomePage

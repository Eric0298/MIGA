import { CalendarClock, Play, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import EmptyState from '@/components/ui/EmptyState'
import { useActiveSession } from '@/features/timer/hooks/use-active-session'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { useAllExamAttempts } from '@/features/exams/hooks/use-all-exam-attempts'
import ActiveExamAttemptsBanner from '@/features/exams/components/ActiveExamAttemptsBanner'
import { formatShortDuration, getElapsedMs } from '@/features/timer/utils'
import { formatDayRelative } from '@/features/goals/utils'
import { filterCompletedByDay, sumElapsedMs, toLocalIsoDay } from '@/lib/stats/sessions-stats'
import { computeGoalStatus, type GoalStatus } from '@/lib/stats/goal-status'
import { findNextPlannedDay } from '@/lib/stats/upcoming'
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

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">{t.home.title}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{todayLabel}</p>
      </header>

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      <ActiveExamAttemptsBanner />

      {!isLoading && active && (
        <Link
          to="/app/timer"
          className="flex items-center justify-between gap-3 rounded-2xl bg-apricot p-5 text-white"
        >
          <div>
            <p className="text-xs font-medium opacity-90">
              {active.status === 'paused' ? t.home.pausedSession : t.home.activeSession}
            </p>
            <p className="mt-0.5 text-base font-semibold">{activeGoalName}</p>
          </div>
          <Play size={20} aria-hidden="true" />
        </Link>
      )}

      {!isLoading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-5">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              {t.home.today}
            </p>
            <p className="mt-2 text-2xl font-bold text-charcoal tabular-nums">
              {formatShortDuration(todayMs)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-5">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              {t.home.sessionsKpi}
            </p>
            <p className="mt-2 text-2xl font-bold text-charcoal tabular-nums">
              {todaySessions.length}
            </p>
          </div>
        </div>
      )}

      {!isLoading && nextPlanned && (
        <Link
          to={`/app/metas/${nextPlanned.goal.id}`}
          className="flex items-center gap-3 rounded-2xl bg-surface p-4"
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

      {!isLoading && goals && goals.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-charcoal">{t.home.yourGoals}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {goals.map((g) => {
              const info = computeGoalStatus(g, sessions ?? [], today, examAttempts ?? [])
              return (
                <li key={g.id}>
                  <Link
                    to={`/app/metas/${g.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3"
                  >
                    <span
                      className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', dotClass(info.status))}
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-charcoal">{g.name}</p>
                      <p className="text-xs text-[color:var(--color-text-muted)]">
                        {statusLabel(t.goalStatus, info.status, info.actualMs, g.targetMinutes)}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!isLoading && recentSessions.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-charcoal">{t.home.recentSessions}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {recentSessions.map((s) => {
              const name = s.goalId
                ? (goals?.find((g) => g.id === s.goalId)?.name ?? t.common.freeSession)
                : t.common.freeSession
              const day = s.endedAt ? toLocalIsoDay(s.endedAt) : ''
              const dayLabel = day ? formatDayRelative(day, today, locale, relativeLabels) : ''
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

function dotClass(status: GoalStatus): string {
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
  const percent =
    targetMinutes === 0 ? 0 : Math.min(100, Math.round((actualMs / 60_000 / targetMinutes) * 100))
  if (status === 'not-started') return goalStatusMessages.notStarted
  if (status === 'complete') return goalStatusMessages.complete
  if (status === 'ahead') return tpl(goalStatusMessages.ahead, { percent })
  if (status === 'on-track') return tpl(goalStatusMessages.onTrack, { percent })
  return tpl(goalStatusMessages.behind, { percent })
}

export default HomePage

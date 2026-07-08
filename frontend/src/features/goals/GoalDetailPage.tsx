import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BarChart3, CalendarDays, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { useLiveGoal } from './hooks/use-goal'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { deleteSession } from '@/lib/db/sessions.repository'
import {
  filterCompletedByGoal,
  groupCompletedMsByDay,
  sumElapsedMs,
  toLocalIsoDay,
} from '@/lib/stats/sessions-stats'
import { formatShortDuration, getElapsedMs } from '@/features/timer/utils'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import GoalProgress from './components/GoalProgress'
import GoalCalendarView from './components/GoalCalendarView'
import GoalProgressChart from './components/GoalProgressChart'
import EmptyState from '@/components/ui/EmptyState'

type View = 'calendar' | 'chart'

function GoalDetailPage() {
  const { t, locale } = useT()
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)
  const sessions = useCompletedSessions()
  const [view, setView] = useState<View>('calendar')
  const todayIsoStr = toLocalIsoDay(Date.now())

  const isLoading = goal === undefined || sessions === undefined
  const goalSessions = useMemo(
    () => (goal && sessions ? filterCompletedByGoal(sessions, goal.id) : []),
    [goal, sessions],
  )
  const currentMs = sumElapsedMs(goalSessions)
  const workedDays = useMemo(() => {
    const grouped = groupCompletedMsByDay(goalSessions)
    return new Set(grouped.keys())
  }, [goalSessions])
  const scheduledDays = useMemo(() => new Set(goal?.scheduledDays ?? []), [goal?.scheduledDays])

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      toast.success(t.sessions.deleted)
    } catch {
      toast.error(t.sessions.cannotDelete)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/app/metas"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.common.back}
        </Link>
      </header>

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {!isLoading && goal === null && (
        <EmptyState
          title={t.goalDetail.notFoundTitle}
          description={t.goalDetail.notFoundDescription}
          action={
            <Link
              to="/app/metas"
              className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
            >
              {t.goalDetail.backToGoals}
            </Link>
          }
        />
      )}

      {!isLoading && goal && (
        <>
          <section className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold text-charcoal">{goal.name}</h1>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {goal.scheduledDays.length === 1
                ? tpl(t.goalDetail.plannedDayOne, { count: goal.scheduledDays.length })
                : tpl(t.goalDetail.plannedDayOther, { count: goal.scheduledDays.length })}{' '}
              ·{' '}
              {workedDays.size === 1
                ? tpl(t.goalDetail.workedDayOne, { count: workedDays.size })
                : tpl(t.goalDetail.workedDayOther, { count: workedDays.size })}
            </p>
            <GoalProgress currentMs={currentMs} targetMinutes={goal.targetMinutes} />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-charcoal">{t.goalDetail.progress}</h2>
              <div
                role="tablist"
                aria-label={t.goalDetail.progressViewLabel}
                className="inline-flex rounded-xl bg-cream p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'calendar'}
                  onClick={() => setView('calendar')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    view === 'calendar'
                      ? 'bg-surface text-charcoal'
                      : 'text-[color:var(--color-text-muted)]',
                  )}
                >
                  <CalendarDays size={14} aria-hidden="true" />
                  {t.goalDetail.calendar}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'chart'}
                  onClick={() => setView('chart')}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    view === 'chart'
                      ? 'bg-surface text-charcoal'
                      : 'text-[color:var(--color-text-muted)]',
                  )}
                >
                  <BarChart3 size={14} aria-hidden="true" />
                  {t.goalDetail.chart}
                </button>
              </div>
            </div>
            {view === 'calendar' ? (
              <GoalCalendarView scheduledDays={scheduledDays} workedDays={workedDays} />
            ) : (
              <GoalProgressChart goal={goal} sessions={sessions ?? []} todayIso={todayIsoStr} />
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-charcoal">{t.goalDetail.sessions}</h2>
            {goalSessions.length === 0 ? (
              <EmptyState
                icon={<Clock size={20} aria-hidden="true" />}
                title={t.goalDetail.noSessionsTitle}
                description={t.goalDetail.noSessionsDescription}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {goalSessions.map((s) => {
                  const label = s.endedAt
                    ? format(new Date(s.endedAt), "d 'de' LLL · HH:mm", { locale })
                    : ''
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-charcoal tabular-nums">
                          {formatShortDuration(getElapsedMs(s))}
                        </p>
                        <p className="text-xs text-[color:var(--color-text-muted)]">{label}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(s.id)}
                        aria-label={t.sessions.deleteAria}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default GoalDetailPage

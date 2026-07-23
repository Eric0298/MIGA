import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router'
import { BarChart3, Clock, ListChecks, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { format } from 'date-fns'
import { toast } from 'sonner'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'
import { useT } from '@/i18n/i18n-context'
import { useAllExamAttempts } from '@/features/exams/hooks/use-all-exam-attempts'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { formatShortDuration, getElapsedMs } from '@/features/timer/utils'
import { deleteSession } from '@/lib/db/sessions.repository'
import type { Session } from '@/lib/db/schema'
import { useCompletedSessions } from './hooks/use-completed-sessions'
import SessionCard from './components/SessionCard'

const WeeklyStats = lazy(() => import('./components/WeeklyStats'))

type View = 'list' | 'stats'

function SessionsPage() {
  const { t } = useT()
  const [view, setView] = useState<View>('list')
  const sessions = useCompletedSessions()
  const examAttempts = useAllExamAttempts()
  const isLoading = sessions === undefined
  const isEmpty = !isLoading && sessions.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-charcoal lg:text-3xl">{t.sessions.title}</h1>
        <div
          role="tablist"
          aria-label={t.sessions.viewLabel}
          className="inline-flex rounded-xl bg-cream p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            onClick={() => setView('list')}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'list' ? 'bg-surface text-charcoal' : 'text-[color:var(--color-text-muted)]',
            )}
          >
            <ListChecks size={14} aria-hidden="true" />
            {t.sessions.tabList}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'stats'}
            onClick={() => setView('stats')}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              view === 'stats'
                ? 'bg-surface text-charcoal'
                : 'text-[color:var(--color-text-muted)]',
            )}
          >
            <BarChart3 size={14} aria-hidden="true" />
            {t.sessions.tabStats}
          </button>
        </div>
      </header>

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {!isLoading && view === 'list' && (
        <>
          {isEmpty && (
            <EmptyState
              icon={<Clock size={20} aria-hidden="true" />}
              title={t.sessions.emptyTitle}
              description={t.sessions.emptyDescription}
            />
          )}
          {sessions.length > 0 && (
            <>
              <ul className="flex flex-col gap-3 lg:hidden">
                {sessions.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </ul>
              <SessionsTable sessions={sessions} />
            </>
          )}
        </>
      )}

      {!isLoading && view === 'stats' && (
        <Suspense fallback={<Loading />}>
          <WeeklyStats sessions={sessions} examAttempts={examAttempts ?? []} />
        </Suspense>
      )}
    </div>
  )
}

type SessionsTableProps = {
  sessions: Session[]
}

function SessionsTable({ sessions }: SessionsTableProps) {
  const { t, locale } = useT()
  const goals = useLiveGoals()

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id)
      toast.success(t.sessions.deleted)
    } catch {
      toast.error(t.sessions.cannotDelete)
    }
  }

  return (
    <div className="hidden overflow-hidden rounded-2xl bg-surface lg:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-border)] text-left text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
            <th scope="col" className="px-5 py-3">
              {t.sessions.table.goal}
            </th>
            <th scope="col" className="px-5 py-3 text-right tabular-nums">
              {t.sessions.table.duration}
            </th>
            <th scope="col" className="px-5 py-3">
              {t.sessions.table.date}
            </th>
            <th scope="col" className="px-5 py-3 tabular-nums">
              {t.sessions.table.time}
            </th>
            <th scope="col" className="px-5 py-3 text-right">
              <span className="sr-only">{t.sessions.table.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const goal = goals?.find((g) => g.id === s.goalId) ?? null
            const goalName = goal ? goal.name : t.common.freeSession
            const dateLabel = s.endedAt
              ? format(new Date(s.endedAt), "d 'de' LLL", { locale })
              : ''
            const timeLabel = s.endedAt ? format(new Date(s.endedAt), 'HH:mm') : ''
            return (
              <tr
                key={s.id}
                className="border-t border-[color:var(--color-border)] transition-colors hover:bg-peach/20"
              >
                <td className="px-5 py-3">
                  <Link
                    to={`/app/sesiones/${s.id}`}
                    className="text-sm font-semibold text-charcoal hover:underline"
                  >
                    {goalName}
                  </Link>
                </td>
                <td className="px-5 py-3 text-right text-sm font-semibold text-charcoal tabular-nums">
                  {formatShortDuration(getElapsedMs(s))}
                </td>
                <td className="px-5 py-3 text-sm text-[color:var(--color-text-muted)]">
                  {dateLabel}
                </td>
                <td className="px-5 py-3 text-sm text-[color:var(--color-text-muted)] tabular-nums">
                  {timeLabel}
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    aria-label={t.sessions.deleteAria}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default SessionsPage

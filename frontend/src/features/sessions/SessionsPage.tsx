import { lazy, Suspense, useState } from 'react'
import { BarChart3, Clock, ListChecks } from 'lucide-react'
import { clsx } from 'clsx'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'
import { useT } from '@/i18n/i18n-context'
import { useCompletedSessions } from './hooks/use-completed-sessions'
import SessionCard from './components/SessionCard'

const WeeklyStats = lazy(() => import('./components/WeeklyStats'))

type View = 'list' | 'stats'

function SessionsPage() {
  const { t } = useT()
  const [view, setView] = useState<View>('list')
  const sessions = useCompletedSessions()
  const isLoading = sessions === undefined
  const isEmpty = !isLoading && sessions.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-charcoal">{t.sessions.title}</h1>
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
            <ul className="flex flex-col gap-3">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </ul>
          )}
        </>
      )}

      {!isLoading && view === 'stats' && (
        <Suspense fallback={<Loading />}>
          <WeeklyStats sessions={sessions} />
        </Suspense>
      )}
    </div>
  )
}

export default SessionsPage

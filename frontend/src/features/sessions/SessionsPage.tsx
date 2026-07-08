import { Clock } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useT } from '@/i18n/i18n-context'
import { useCompletedSessions } from './hooks/use-completed-sessions'
import SessionCard from './components/SessionCard'

function SessionsPage() {
  const { t } = useT()
  const sessions = useCompletedSessions()
  const isLoading = sessions === undefined
  const isEmpty = !isLoading && sessions.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">{t.sessions.title}</h1>
      </header>

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {isEmpty && (
        <EmptyState
          icon={<Clock size={20} aria-hidden="true" />}
          title={t.sessions.emptyTitle}
          description={t.sessions.emptyDescription}
        />
      )}

      {!isLoading && sessions.length > 0 && (
        <ul className="flex flex-col gap-3">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default SessionsPage

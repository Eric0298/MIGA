import { Clock } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useCompletedSessions } from './hooks/use-completed-sessions'
import SessionCard from './components/SessionCard'

function SessionsPage() {
  const sessions = useCompletedSessions()
  const isLoading = sessions === undefined
  const isEmpty = !isLoading && sessions.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Sesiones</h1>
      </header>

      {isLoading && <p className="text-sm text-[color:var(--color-text-muted)]">Cargando…</p>}

      {isEmpty && (
        <EmptyState
          icon={<Clock size={20} aria-hidden="true" />}
          title="Sin sesiones registradas"
          description="Cuando detengas una sesión aparecerá aquí con su duración real."
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

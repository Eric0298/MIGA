import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Session } from '@/lib/db/schema'
import { deleteSession } from '@/lib/db/sessions.repository'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { formatShortDuration, getElapsedMs } from '@/features/timer/utils'

type SessionCardProps = {
  session: Session
}

function SessionCard({ session }: SessionCardProps) {
  const goals = useLiveGoals()
  const goal = goals?.find((g) => g.id === session.goalId) ?? null
  const duration = getElapsedMs(session)
  const dateLabel = session.endedAt
    ? format(new Date(session.endedAt), "d 'de' LLL · HH:mm", { locale: es })
    : ''

  const handleDelete = async () => {
    try {
      await deleteSession(session.id)
      toast.success('Sesión borrada')
    } catch {
      toast.error('No se pudo borrar')
    }
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl bg-surface p-5">
      <div className="flex-1">
        <h3 className="text-base font-semibold text-charcoal">
          {goal ? goal.name : 'Sesión libre'}
        </h3>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          {formatShortDuration(duration)} · {dateLabel}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        aria-label="Borrar sesión"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </li>
  )
}

export default SessionCard

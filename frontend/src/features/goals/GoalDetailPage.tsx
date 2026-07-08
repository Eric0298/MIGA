import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useLiveGoal } from './hooks/use-goal'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { deleteSession } from '@/lib/db/sessions.repository'
import {
  filterCompletedByGoal,
  groupCompletedMsByDay,
  sumElapsedMs,
} from '@/lib/stats/sessions-stats'
import { formatShortDuration, getElapsedMs } from '@/features/timer/utils'
import GoalProgress from './components/GoalProgress'
import GoalCalendarView from './components/GoalCalendarView'
import EmptyState from '@/components/ui/EmptyState'
import { Clock } from 'lucide-react'

function GoalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)
  const sessions = useCompletedSessions()

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
      toast.success('Sesión borrada')
    } catch {
      toast.error('No se pudo borrar')
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
          Volver
        </Link>
      </header>

      {isLoading && <p className="text-sm text-[color:var(--color-text-muted)]">Cargando…</p>}

      {!isLoading && goal === null && (
        <EmptyState
          title="Meta no encontrada"
          description="Puede que la hayas borrado o el enlace sea inválido."
          action={
            <Link
              to="/app/metas"
              className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
            >
              Volver a metas
            </Link>
          }
        />
      )}

      {!isLoading && goal && (
        <>
          <section className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold text-charcoal">{goal.name}</h1>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {goal.scheduledDays.length} días planificados · {workedDays.size} días con sesión
            </p>
            <GoalProgress currentMs={currentMs} targetMinutes={goal.targetMinutes} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-charcoal">Calendario</h2>
            <GoalCalendarView scheduledDays={scheduledDays} workedDays={workedDays} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-charcoal">Sesiones</h2>
            {goalSessions.length === 0 ? (
              <EmptyState
                icon={<Clock size={20} aria-hidden="true" />}
                title="Aún sin sesiones"
                description="Cuando registres una sesión vinculada a esta meta aparecerá aquí."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {goalSessions.map((s) => {
                  const label = s.endedAt
                    ? format(new Date(s.endedAt), "d 'de' LLL · HH:mm", { locale: es })
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
                        aria-label="Borrar sesión"
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

import { Play, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import EmptyState from '@/components/ui/EmptyState'
import { useActiveSession } from '@/features/timer/hooks/use-active-session'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { formatShortDuration, getElapsedMs } from '@/features/timer/utils'
import { filterCompletedByDay, sumElapsedMs, toLocalIsoDay } from '@/lib/stats/sessions-stats'

function HomePage() {
  const active = useActiveSession()
  const sessions = useCompletedSessions()
  const goals = useLiveGoals()
  const isLoading = active === undefined || sessions === undefined || goals === undefined

  const today = toLocalIsoDay(Date.now())
  const todaySessions = sessions ? filterCompletedByDay(sessions, today) : []
  const todayMs = sumElapsedMs(todaySessions)
  const raw = format(new Date(), "EEEE d 'de' LLLL", { locale: es })
  const todayLabel = raw.charAt(0).toUpperCase() + raw.slice(1)
  const activeGoalName = active
    ? (goals?.find((g) => g.id === active.goalId)?.name ?? 'Sesión libre')
    : null

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Inicio</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{todayLabel}</p>
      </header>

      {isLoading && <p className="text-sm text-[color:var(--color-text-muted)]">Cargando…</p>}

      {!isLoading && active && (
        <Link
          to="/app/timer"
          className="flex items-center justify-between gap-3 rounded-2xl bg-apricot p-5 text-white"
        >
          <div>
            <p className="text-xs font-medium opacity-90">
              {active.status === 'paused' ? 'Sesión pausada' : 'Sesión activa'}
            </p>
            <p className="mt-0.5 text-base font-semibold">{activeGoalName}</p>
          </div>
          <Play size={20} aria-hidden="true" />
        </Link>
      )}

      {!isLoading && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-5">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">Hoy</p>
            <p className="mt-2 text-2xl font-bold text-charcoal tabular-nums">
              {formatShortDuration(todayMs)}
            </p>
          </div>
          <div className="rounded-2xl bg-surface p-5">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">Sesiones</p>
            <p className="mt-2 text-2xl font-bold text-charcoal tabular-nums">
              {todaySessions.length}
            </p>
          </div>
        </div>
      )}

      {!isLoading && todaySessions.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-charcoal">Sesiones de hoy</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {todaySessions.map((s) => {
              const name = s.goalId
                ? (goals?.find((g) => g.id === s.goalId)?.name ?? 'Sesión libre')
                : 'Sesión libre'
              const timeLabel = s.endedAt ? format(new Date(s.endedAt), 'HH:mm') : ''
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-charcoal">{name}</p>
                    <p className="text-xs text-[color:var(--color-text-muted)]">
                      Terminada a las {timeLabel}
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

      {!isLoading && !active && todaySessions.length === 0 && (
        <EmptyState
          icon={<Sparkles size={20} aria-hidden="true" />}
          title="Todo empieza con una acción"
          description="Cuando registres tu primera sesión verás tu avance aquí."
          action={
            <Link
              to="/app/timer"
              className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
            >
              Iniciar sesión
            </Link>
          }
        />
      )}
    </div>
  )
}

export default HomePage

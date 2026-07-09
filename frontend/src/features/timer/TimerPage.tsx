import { useState } from 'react'
import { Timer as TimerIcon } from 'lucide-react'
import { useLocation } from 'react-router'
import EmptyState from '@/components/ui/EmptyState'
import { useT } from '@/i18n/i18n-context'
import { useActiveSession } from './hooks/use-active-session'
import StartSessionPanel from './components/StartSessionPanel'
import TimerDisplay from './components/TimerDisplay'
import TimerMaterialSession from './components/TimerMaterialSession'

type TimerLocationState = {
  goalId?: string
  materialIds?: string[]
}

function TimerPage() {
  const { t } = useT()
  const location = useLocation()
  const state = (location.state ?? null) as TimerLocationState | null
  const [showStart, setShowStart] = useState(
    Boolean(state?.goalId || (state?.materialIds && state.materialIds.length > 0)),
  )
  const active = useActiveSession()
  const isLoading = active === undefined
  // Any session that has a goal or already-attached materials uses the
  // multi-material shell so the "+ Añadir" button is always reachable.
  // Truly free sessions (no goal, no materials) keep the simpler chrome.
  const hasMaterialSession =
    active !== null &&
    active !== undefined &&
    (active.materialIds.length > 0 || active.goalId !== null)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">{t.timer.title}</h1>
      </header>

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {!isLoading && active && hasMaterialSession && <TimerMaterialSession session={active} />}
      {!isLoading && active && !hasMaterialSession && <TimerDisplay session={active} />}

      {!isLoading && !active && showStart && (
        <StartSessionPanel
          onStarted={() => setShowStart(false)}
          onCancel={() => setShowStart(false)}
          initialGoalId={state?.goalId ?? null}
          initialMaterialIds={state?.materialIds ?? []}
        />
      )}

      {!isLoading && !active && !showStart && (
        <>
          <EmptyState
            icon={<TimerIcon size={20} aria-hidden="true" />}
            title={t.timer.noActiveTitle}
            description={t.timer.noActiveDescription}
          />
          <button
            type="button"
            onClick={() => setShowStart(true)}
            className="w-full rounded-2xl bg-apricot px-5 py-3.5 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            {t.timer.startSession}
          </button>
        </>
      )}
    </div>
  )
}

export default TimerPage

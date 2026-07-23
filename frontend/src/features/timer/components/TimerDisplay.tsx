import { Pause, Play, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import type { Session } from '@/lib/db/schema'
import {
  discardSession,
  pauseSession,
  resumeSession,
  stopSession,
} from '@/lib/db/sessions.repository'
import { useT } from '@/i18n/i18n-context'
import { useElapsedTick } from '../hooks/use-elapsed-tick'
import { formatDuration, getElapsedMs } from '../utils'

type TimerDisplayProps = {
  session: Session
}

function TimerDisplay({ session }: TimerDisplayProps) {
  const { t } = useT()
  const goals = useLiveGoals()
  const goal = goals?.find((g) => g.id === session.goalId) ?? null
  const now = useElapsedTick(session.status === 'running')
  const elapsed = getElapsedMs(session, now)

  const handlePause = async () => {
    try {
      await pauseSession(session.id)
    } catch {
      toast.error(t.timer.cannotPause)
    }
  }

  const handleResume = async () => {
    try {
      await resumeSession(session.id)
    } catch {
      toast.error(t.timer.cannotResume)
    }
  }

  const handleStop = async () => {
    try {
      await stopSession(session.id)
      toast.success(t.timer.sessionSaved)
    } catch {
      toast.error(t.timer.cannotStop)
    }
  }

  const handleDiscard = async () => {
    try {
      await discardSession(session.id)
      toast.success(t.timer.sessionDiscarded)
    } catch {
      toast.error(t.timer.cannotDiscard)
    }
  }

  const isPaused = session.status === 'paused'

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-2xl bg-surface p-6 lg:p-8">
      <div className="text-center">
        <p className="text-sm font-medium text-charcoal">
          {goal ? goal.name : t.common.freeSession}
        </p>
        {isPaused && <p className="mt-1 text-xs font-medium text-apricot">{t.timer.paused}</p>}
      </div>

      <p className="text-5xl font-bold text-charcoal tabular-nums" aria-live="polite">
        {formatDuration(elapsed)}
      </p>

      <div className="flex w-full gap-3">
        {isPaused ? (
          <button
            type="button"
            onClick={handleResume}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            <Play size={18} aria-hidden="true" />
            {t.timer.resume}
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-cream px-5 py-3 text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            <Pause size={18} aria-hidden="true" />
            {t.timer.pause}
          </button>
        )}
        <button
          type="button"
          onClick={handleStop}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-charcoal px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98]"
        >
          <Square size={18} aria-hidden="true" />
          {t.timer.stop}
        </button>
      </div>

      <button
        type="button"
        onClick={handleDiscard}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-charcoal"
      >
        <Trash2 size={14} aria-hidden="true" />
        {t.timer.discard}
      </button>
    </div>
  )
}

export default TimerDisplay

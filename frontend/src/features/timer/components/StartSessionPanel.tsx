import { useState } from 'react'
import { toast } from 'sonner'
import { startSession } from '@/lib/db/sessions.repository'
import GoalPicker from './GoalPicker'

type StartSessionPanelProps = {
  onStarted?: () => void
  onCancel?: () => void
}

function StartSessionPanel({ onStarted, onCancel }: StartSessionPanelProps) {
  const [goalId, setGoalId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleStart = async () => {
    try {
      setSubmitting(true)
      await startSession({ goalId })
      toast.success('Sesión iniciada')
      onStarted?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo iniciar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-surface p-5">
      <div>
        <h2 className="text-base font-semibold text-charcoal">Elige una meta</h2>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
          O empieza una sesión libre sin vincular a ninguna.
        </p>
      </div>

      <GoalPicker value={goalId} onChange={setGoalId} />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={submitting}
          className="flex-1 rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          Empezar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-cream px-5 py-3 text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default StartSessionPanel

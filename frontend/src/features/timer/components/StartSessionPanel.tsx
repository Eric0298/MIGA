import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { startSession } from '@/lib/db/sessions.repository'
import { useT } from '@/i18n/i18n-context'
import GoalPicker from './GoalPicker'
import MaterialPicker from './MaterialPicker'

type StartSessionPanelProps = {
  onStarted?: () => void
  onCancel?: () => void
  initialGoalId?: string | null
  initialMaterialIds?: string[]
}

function StartSessionPanel({
  onStarted,
  onCancel,
  initialGoalId,
  initialMaterialIds,
}: StartSessionPanelProps) {
  const { t } = useT()
  const [goalId, setGoalId] = useState<string | null>(initialGoalId ?? null)
  const [materialIds, setMaterialIds] = useState<string[]>(initialMaterialIds ?? [])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMaterialIds([])
  }, [goalId])

  useEffect(() => {
    if (initialMaterialIds && initialMaterialIds.length > 0) setMaterialIds(initialMaterialIds)
  }, [initialMaterialIds])

  const toggleMaterial = (id: string) => {
    setMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleStart = async () => {
    try {
      setSubmitting(true)
      await startSession({ goalId, materialIds })
      toast.success(t.timer.sessionStarted)
      onStarted?.()
    } catch (error) {
      const message =
        error instanceof Error && error.message === 'Ya hay una sesión activa'
          ? t.timer.activeSessionExists
          : t.timer.cannotStart
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-surface p-5">
      <div>
        <h2 className="text-base font-semibold text-charcoal">{t.timer.chooseGoal}</h2>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
          {t.timer.chooseGoalHint}
        </p>
      </div>

      <GoalPicker value={goalId} onChange={setGoalId} />

      <MaterialPicker goalId={goalId} values={materialIds} onToggle={toggleMaterial} />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={submitting}
          className="flex-1 rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {t.timer.start}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-cream px-5 py-3 text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
        >
          {t.common.cancel}
        </button>
      </div>
    </div>
  )
}

export default StartSessionPanel

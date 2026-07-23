import { useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { finishPdfExamAttempt, gradePdfExamAttempt } from '@/lib/db/exam-attempts.repository'
import type { ExamAttempt } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'

type SimulacroGradeDialogProps = {
  attempt: ExamAttempt
  /** If true, use finishPdfExamAttempt (still active); otherwise gradePdfExamAttempt (already pending). */
  mode: 'finish' | 'grade-pending'
  onDone: () => void
  onCancel: () => void
}

/**
 * Modal-style form to enter a manual score for a PDF simulacro. Used both
 * when finishing a live attempt ("Calificar ahora") and when grading a
 * previously-pending attempt from the list.
 */
function SimulacroGradeDialog({ attempt, mode, onDone, onCancel }: SimulacroGradeDialogProps) {
  const { t } = useT()
  const initialMax = attempt.maxScore ?? 10
  const [score, setScore] = useState<string>(attempt.score !== null ? String(attempt.score) : '')
  const [maxScore, setMaxScore] = useState<string>(String(initialMax))
  const [notes, setNotes] = useState<string>(attempt.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const parsedScore = parseFloat(score.replace(',', '.'))
    const parsedMax = parseFloat(maxScore.replace(',', '.'))
    if (!Number.isFinite(parsedScore) || parsedScore < 0) {
      toast.error(t.examenes.grade.errors.invalidScore)
      return
    }
    if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
      toast.error(t.examenes.grade.errors.invalidMax)
      return
    }
    if (parsedScore > parsedMax) {
      toast.error(t.examenes.grade.errors.scoreOverMax)
      return
    }
    try {
      setSaving(true)
      if (mode === 'finish') {
        await finishPdfExamAttempt(attempt.id, {
          score: parsedScore,
          maxScore: parsedMax,
          notes,
        })
      } else {
        await gradePdfExamAttempt(attempt.id, parsedScore, parsedMax, notes)
      }
      toast.success(t.examenes.grade.saved)
      onDone()
    } catch {
      toast.error(t.examenes.grade.cannotSave)
    } finally {
      setSaving(false)
    }
  }

  const percentage =
    Number.isFinite(parseFloat(score)) && parseFloat(maxScore) > 0
      ? Math.round(
          (parseFloat(score.replace(',', '.')) / parseFloat(maxScore.replace(',', '.'))) * 100,
        )
      : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-4 shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t.examenes.grade.dialogLabel}
            </p>
            <p className="mt-1 truncate text-base font-bold text-charcoal">{attempt.title}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t.common.cancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] hover:bg-cream hover:text-charcoal"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="grade-score" className="text-xs font-semibold text-charcoal">
              {t.examenes.grade.score}
            </label>
            <input
              id="grade-score"
              type="text"
              inputMode="decimal"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="7.5"
              className="rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            />
          </div>
          <span className="pb-2 text-lg font-semibold text-charcoal">/</span>
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="grade-max" className="text-xs font-semibold text-charcoal">
              {t.examenes.grade.maxScore}
            </label>
            <input
              id="grade-max"
              type="text"
              inputMode="decimal"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              placeholder="10"
              className="rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            />
          </div>
        </div>

        {percentage !== null && (
          <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
            {t.examenes.grade.percentageHint}{' '}
            <span className="font-bold text-charcoal">{percentage}%</span>
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="grade-notes" className="text-xs font-semibold text-charcoal">
            {t.examenes.grade.notesLabel}
          </label>
          <textarea
            id="grade-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.examenes.grade.notesPlaceholder}
            maxLength={10_000}
            rows={4}
            className="resize-none rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
          />
          <p className="text-[11px] text-[color:var(--color-text-muted)]">
            {t.examenes.grade.notesHint}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-2xl bg-apricot px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {t.examenes.grade.save}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            {t.common.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SimulacroGradeDialog

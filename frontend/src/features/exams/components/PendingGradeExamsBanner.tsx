import { useState } from 'react'
import { ClipboardCheck, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { usePendingGradeExamAttempts } from '@/features/exams/hooks/use-pending-grade-exam-attempts'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { deleteExamAttempt } from '@/lib/db/exam-attempts.repository'
import type { ExamAttempt } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import SimulacroGradeDialog from './SimulacroGradeDialog'

/**
 * Cross-goal surface for PDF simulacros the user left as "pending grade".
 * They already appear in the goal-scoped list, but users who accumulate
 * pending attempts across multiple goals would otherwise have to visit
 * each goal one by one to grade them. Renders nothing when there is none.
 */
function PendingGradeExamsBanner() {
  const { t, locale } = useT()
  const attempts = usePendingGradeExamAttempts()
  const goals = useLiveGoals()
  const [gradingAttempt, setGradingAttempt] = useState<ExamAttempt | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  if (!attempts || attempts.length === 0) return null

  const handleDelete = async (id: string) => {
    try {
      setPendingDeleteId(id)
      await deleteExamAttempt(id)
      toast.success(t.examenes.pendingGrade.deleted)
    } catch {
      toast.error(t.examenes.pendingGrade.deleteError)
    } finally {
      setPendingDeleteId(null)
    }
  }

  const title =
    attempts.length === 1
      ? t.examenes.pendingGrade.titleOne
      : tpl(t.examenes.pendingGrade.titleOther, { count: attempts.length })

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl bg-pistachio/20 p-4 ring-1 ring-pistachio/60"
      aria-labelledby="pending-grade-exams-title"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-pistachio text-charcoal">
          <ClipboardCheck size={14} aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p id="pending-grade-exams-title" className="text-sm font-semibold text-charcoal">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
            {t.examenes.pendingGrade.description}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {attempts.map((attempt) => {
          const goal = goals?.find((g) => g.id === attempt.goalId)
          const goalName = goal?.name ?? t.examenes.pendingGrade.unknownGoal
          const finishedAgo =
            attempt.endedAt !== null
              ? formatDistanceToNow(new Date(attempt.endedAt), {
                  addSuffix: true,
                  locale,
                })
              : ''
          const isDeleting = pendingDeleteId === attempt.id
          return (
            <li
              key={attempt.id}
              className="flex flex-col gap-2 rounded-xl bg-surface p-3 ring-1 ring-[color:var(--color-border)]"
            >
              <div className="flex flex-col gap-0.5">
                <p className="truncate text-sm font-semibold text-charcoal">{attempt.title}</p>
                <p className="text-[11px] text-[color:var(--color-text-muted)]">
                  {goalName}
                  {finishedAgo ? ` · ${finishedAgo}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGradingAttempt(attempt)}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
                >
                  <ClipboardCheck size={14} aria-hidden="true" />
                  {t.examenes.pendingGrade.gradeNow}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(attempt.id)}
                  disabled={isDeleting}
                  aria-label={t.examenes.pendingGrade.delete}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-cream text-[color:var(--color-text-muted)] ring-1 ring-[color:var(--color-border)] transition-colors hover:text-charcoal disabled:opacity-60"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {gradingAttempt && (
        <SimulacroGradeDialog
          attempt={gradingAttempt}
          mode="grade-pending"
          onDone={() => setGradingAttempt(null)}
          onCancel={() => setGradingAttempt(null)}
        />
      )}
    </section>
  )
}

export default PendingGradeExamsBanner

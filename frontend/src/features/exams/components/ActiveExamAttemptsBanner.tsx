import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AlertTriangle, PlayCircle, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useActiveExamAttempts } from '@/features/exams/hooks/use-active-exam-attempts'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { discardExamAttempt } from '@/lib/db/exam-attempts.repository'
import type { ExamAttempt } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'

/**
 * Compact recovery card shown when the user left one or more exam attempts
 * open. Each row lets them jump back into the attempt or discard it.
 * Renders nothing when there are no open attempts (idle state).
 */
function ActiveExamAttemptsBanner() {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const attempts = useActiveExamAttempts()
  const goals = useLiveGoals()
  const [pendingDiscardId, setPendingDiscardId] = useState<string | null>(null)

  if (!attempts || attempts.length === 0) return null

  const resumePath = (a: ExamAttempt) =>
    a.kind === 'pdf'
      ? `/app/examenes/${a.goalId}/simulacro/${a.id}`
      : `/app/examenes/${a.goalId}/preguntas/${a.id}`

  const handleDiscard = async (id: string) => {
    try {
      setPendingDiscardId(id)
      await discardExamAttempt(id)
      toast.success(t.examenes.recovery.discarded)
    } catch {
      toast.error(t.examenes.recovery.discardError)
    } finally {
      setPendingDiscardId(null)
    }
  }

  const title =
    attempts.length === 1
      ? t.examenes.recovery.titleOne
      : tpl(t.examenes.recovery.titleOther, { count: attempts.length })

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl bg-apricot/10 p-4 ring-1 ring-apricot/40"
      aria-labelledby="active-exam-attempts-title"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-apricot text-white">
          <AlertTriangle size={14} aria-hidden="true" />
        </span>
        <div className="flex-1">
          <p id="active-exam-attempts-title" className="text-sm font-semibold text-charcoal">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
            {t.examenes.recovery.description}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {attempts.map((attempt) => {
          const goal = goals?.find((g) => g.id === attempt.goalId)
          const goalName = goal?.name ?? t.examenes.recovery.unknownGoal
          const startedAgo = formatDistanceToNow(new Date(attempt.startedAt), {
            addSuffix: true,
            locale,
          })
          const isPaused = attempt.status === 'paused'
          const isDiscarding = pendingDiscardId === attempt.id
          return (
            <li
              key={attempt.id}
              className="flex flex-col gap-2 rounded-xl bg-surface p-3 ring-1 ring-[color:var(--color-border)]"
            >
              <div className="flex flex-col gap-0.5">
                <p className="truncate text-sm font-semibold text-charcoal">{attempt.title}</p>
                <p className="text-[11px] text-[color:var(--color-text-muted)]">
                  {goalName} ·{' '}
                  {isPaused ? t.examenes.recovery.pausedTag : t.examenes.recovery.inProgressTag} ·{' '}
                  {startedAgo}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(resumePath(attempt))}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
                >
                  <PlayCircle size={14} aria-hidden="true" />
                  {t.examenes.recovery.resume}
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscard(attempt.id)}
                  disabled={isDiscarding}
                  aria-label={t.examenes.recovery.discard}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-cream text-[color:var(--color-text-muted)] ring-1 ring-[color:var(--color-border)] transition-colors hover:text-charcoal disabled:opacity-60"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default ActiveExamAttemptsBanner

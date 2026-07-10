import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Eye, FilePlus2, PlayCircle, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { useLiveGoal } from '@/features/goals/hooks/use-goal'
import { useExamAttemptsByGoal } from '@/features/exams/hooks/use-exam-attempts-by-goal'
import SimulacroGradeDialog from '@/features/exams/components/SimulacroGradeDialog'
import {
  deleteExamAttempt,
  getExamElapsedMs,
} from '@/lib/db/exam-attempts.repository'
import { formatDuration } from '@/features/timer/utils'
import type { ExamAttempt } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'

function ExamenesGoalPage() {
  const { t, locale } = useT()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)
  const attempts = useExamAttemptsByGoal(goal?.id) ?? []
  const [gradingAttempt, setGradingAttempt] = useState<ExamAttempt | null>(null)

  const handleDelete = async (attempt: ExamAttempt) => {
    try {
      await deleteExamAttempt(attempt.id)
      toast.success(t.examenes.deleted)
    } catch {
      toast.error(t.examenes.cannotDelete)
    }
  }

  if (goal === undefined) return <Loading />
  if (goal === null) {
    return (
      <EmptyState
        title={t.goalDetail.notFoundTitle}
        description={t.goalDetail.notFoundDescription}
        action={
          <Link
            to="/app/examenes"
            className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
          >
            {t.examenes.backToExamenes}
          </Link>
        }
      />
    )
  }

  const pdfAttempts = attempts.filter((a) => a.kind === 'pdf' && a.status !== 'discarded')
  const questionAttempts = attempts.filter(
    (a) => a.kind === 'questions' && a.status !== 'discarded',
  )

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/app/examenes"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.examenes.backToExamenes}
        </Link>
      </header>

      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-charcoal">{goal.name}</h1>
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.examenes.perGoalSubtitle}</p>
      </section>

      {/* --------- PDF simulacros --------- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-charcoal">{t.examenes.pdfSection}</h2>
          <button
            type="button"
            onClick={() => navigate(`/app/examenes/${goal.id}/simulacro/nuevo`)}
            className="inline-flex items-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
          >
            <FilePlus2 size={14} aria-hidden="true" />
            {t.examenes.newSimulacro}
          </button>
        </div>

        {pdfAttempts.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {t.examenes.emptyPdfAttempts}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pdfAttempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-col gap-2 rounded-2xl bg-surface p-4 ring-1 ring-[color:var(--color-border)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-charcoal">
                      {attempt.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                      {format(new Date(attempt.startedAt), "d 'de' LLL · HH:mm", {
                        locale,
                      })}
                    </p>
                  </div>
                  <StatusBadge status={attempt.status} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="inline-flex items-center rounded-full bg-cream px-2 py-0.5 text-charcoal ring-1 ring-[color:var(--color-border)]">
                    {formatDuration(getExamElapsedMs(attempt))}
                  </span>
                  {attempt.status === 'graded' &&
                    attempt.score !== null &&
                    attempt.maxScore !== null && (
                      <>
                        <span className="inline-flex items-center rounded-full bg-pistachio/40 px-2 py-0.5 text-charcoal">
                          {attempt.score} / {attempt.maxScore}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-peach px-2 py-0.5 text-charcoal">
                          {Math.round((attempt.score / attempt.maxScore) * 100)}%
                        </span>
                      </>
                    )}
                </div>

                {attempt.notes && (
                  <p className="whitespace-pre-wrap rounded-xl bg-cream/60 px-3 py-2 text-xs text-charcoal">
                    {attempt.notes}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  {(attempt.status === 'in-progress' || attempt.status === 'paused') && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/app/examenes/${goal.id}/simulacro/${attempt.id}`)
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
                    >
                      <PlayCircle size={14} aria-hidden="true" />
                      {t.examenes.continue}
                    </button>
                  )}
                  {attempt.status === 'pending-grade' && (
                    <button
                      type="button"
                      onClick={() => setGradingAttempt(attempt)}
                      className="inline-flex items-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
                    >
                      {t.examenes.gradeNow}
                    </button>
                  )}
                  {attempt.status !== 'in-progress' && attempt.status !== 'paused' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(attempt)}
                      aria-label={t.examenes.deleteAttempt}
                      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --------- Own-questions exams --------- */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-charcoal">
            {t.examenes.questionsSection}
          </h2>
          <button
            type="button"
            onClick={() => navigate(`/app/examenes/${goal.id}/preguntas/nuevo`)}
            className="inline-flex items-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
          >
            <FilePlus2 size={14} aria-hidden="true" />
            {t.examenes.newQuestionsExam}
          </button>
        </div>

        {questionAttempts.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {t.examenes.emptyQuestionAttempts}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {questionAttempts.map((attempt) => (
              <li
                key={attempt.id}
                className="flex flex-col gap-2 rounded-2xl bg-surface p-4 ring-1 ring-[color:var(--color-border)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-charcoal">
                      {attempt.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                      {format(new Date(attempt.startedAt), "d 'de' LLL · HH:mm", {
                        locale,
                      })}
                    </p>
                  </div>
                  <StatusBadge status={attempt.status} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                  <span className="inline-flex items-center rounded-full bg-cream px-2 py-0.5 text-charcoal ring-1 ring-[color:var(--color-border)]">
                    {formatDuration(getExamElapsedMs(attempt))}
                  </span>
                  {attempt.status === 'completed' &&
                    attempt.score !== null &&
                    attempt.maxScore !== null && (
                      <>
                        <span className="inline-flex items-center rounded-full bg-pistachio/40 px-2 py-0.5 text-charcoal">
                          {attempt.score} / {attempt.maxScore}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-peach px-2 py-0.5 text-charcoal">
                          {Math.round((attempt.score / attempt.maxScore) * 100)}%
                        </span>
                      </>
                    )}
                </div>

                {attempt.notes && (
                  <p className="whitespace-pre-wrap rounded-xl bg-cream/60 px-3 py-2 text-xs text-charcoal">
                    {attempt.notes}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2">
                  {attempt.status === 'in-progress' && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/app/examenes/${goal.id}/preguntas/${attempt.id}`)
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
                    >
                      <PlayCircle size={14} aria-hidden="true" />
                      {t.examenes.continue}
                    </button>
                  )}
                  {attempt.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/app/examenes/${goal.id}/preguntas/${attempt.id}`)
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-cream px-3 py-1.5 text-xs font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
                    >
                      <Eye size={14} aria-hidden="true" />
                      {t.examenes.viewResults}
                    </button>
                  )}
                  {attempt.status !== 'in-progress' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(attempt)}
                      aria-label={t.examenes.deleteAttempt}
                      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {gradingAttempt && (
        <SimulacroGradeDialog
          attempt={gradingAttempt}
          mode="grade-pending"
          onDone={() => setGradingAttempt(null)}
          onCancel={() => setGradingAttempt(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ExamAttempt['status'] }) {
  const { t } = useT()
  const label = t.examenes.statusLabels[status]
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        status === 'graded' && 'bg-pistachio/60 text-charcoal',
        status === 'pending-grade' && 'bg-apricot text-white',
        status === 'in-progress' && 'bg-charcoal text-white',
        status === 'paused' && 'bg-charcoal/60 text-white',
        status === 'completed' && 'bg-pistachio/60 text-charcoal',
        status === 'discarded' && 'bg-cream text-[color:var(--color-text-muted)]',
      )}
    >
      {label}
    </span>
  )
}

export default ExamenesGoalPage

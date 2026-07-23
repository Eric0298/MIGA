import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Check, ChevronRight, Square, Timer as TimerIcon, X } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { useLiveGoal } from '@/features/goals/hooks/use-goal'
import { useActiveSession } from '@/features/timer/hooks/use-active-session'
import { useElapsedTick } from '@/features/timer/hooks/use-elapsed-tick'
import QuestionMediaViewer from '@/features/questions/components/QuestionMediaViewer'
import {
  listQuestionsByGoal,
  replaceReviewState,
} from '@/lib/db/questions.repository'
import { startSession, stopSession } from '@/lib/db/sessions.repository'
import type { Question, Session } from '@/lib/db/schema'
import {
  isAnswerCorrect,
  pickNextQuestion,
  updateReviewState,
} from '@/lib/srs/srs'
import { formatDuration, getElapsedMs } from '@/features/timer/utils'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'

type Phase =
  | { kind: 'starting' }
  | { kind: 'blocked'; reason: 'other-active-session' | 'no-questions' | 'cannot-start' }
  | { kind: 'answering'; question: Question }
  | { kind: 'feedback'; question: Question; isCorrect: boolean }
  | { kind: 'ended' }

function RepasoSessionPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)
  const activeSession = useActiveSession()

  const [session, setSession] = useState<Session | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' })
  const [chosenIds, setChosenIds] = useState<string[]>([])
  const [stats, setStats] = useState({ correct: 0, incorrect: 0 })
  const initStartedRef = useRef(false)

  const now = useElapsedTick(session?.status === 'running')
  const elapsed = session ? getElapsedMs(session, now) : 0

  const goalReady = goal !== undefined
  const activeReady = activeSession !== undefined
  const goalId = goal?.id

  // Boot: check active session, pick first question, start a new session.
  useEffect(() => {
    if (initStartedRef.current) return
    if (!goalReady || !activeReady || !goalId) return
    initStartedRef.current = true
    ;(async () => {
      if (activeSession) {
        setPhase({ kind: 'blocked', reason: 'other-active-session' })
        return
      }
      const questions = await listQuestionsByGoal(goalId)
      if (questions.length === 0) {
        setPhase({ kind: 'blocked', reason: 'no-questions' })
        return
      }
      try {
        const created = await startSession({ goalId })
        setSession(created)
        const first = pickNextQuestion(questions)
        if (!first) {
          setPhase({ kind: 'blocked', reason: 'no-questions' })
          return
        }
        setPhase({ kind: 'answering', question: first })
      } catch {
        setPhase({ kind: 'blocked', reason: 'cannot-start' })
      }
    })()
  }, [goalReady, activeReady, activeSession, goalId])

  const toggleAnswer = (answerId: string) => {
    if (phase.kind !== 'answering') return
    setChosenIds((prev) =>
      prev.includes(answerId)
        ? prev.filter((id) => id !== answerId)
        : [...prev, answerId],
    )
  }

  const handleConfirm = async () => {
    if (phase.kind !== 'answering') return
    if (chosenIds.length === 0) {
      toast.error(t.repasoSession.selectAnswer)
      return
    }
    const question = phase.question
    const isCorrect = isAnswerCorrect(question, chosenIds)
    const nextState = updateReviewState(question.reviewState, isCorrect)
    try {
      await replaceReviewState(question.id, nextState)
    } catch {
      // silent — the answer still shows feedback
    }
    setStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (isCorrect ? 0 : 1),
    }))
    setPhase({ kind: 'feedback', question, isCorrect })
  }

  const handleNext = useCallback(async () => {
    if (phase.kind !== 'feedback' || !goalId) return
    const fresh = await listQuestionsByGoal(goalId)
    if (fresh.length === 0) {
      setPhase({ kind: 'ended' })
      return
    }
    let next = pickNextQuestion(fresh, { excludeIds: [phase.question.id] })
    if (!next) next = pickNextQuestion(fresh)
    if (!next) {
      setPhase({ kind: 'ended' })
      return
    }
    setChosenIds([])
    setPhase({ kind: 'answering', question: next })
  }, [phase, goalId])

  const handleEnd = async () => {
    if (session) {
      try {
        await stopSession(session.id)
      } catch {
        // ignore
      }
    }
    setPhase({ kind: 'ended' })
  }

  const handleExit = () => {
    navigate(`/app/repaso/${id ?? ''}`)
  }

  // Render
  if (!goalReady || !activeReady || phase.kind === 'starting') {
    return <Loading />
  }

  if (goal === null) {
    return (
      <EmptyState
        title={t.goalDetail.notFoundTitle}
        description={t.goalDetail.notFoundDescription}
        action={
          <Link
            to="/app/repaso"
            className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
          >
            {t.repaso.backToRepaso}
          </Link>
        }
      />
    )
  }

  if (phase.kind === 'blocked') {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <Link
            to={`/app/repaso/${id ?? ''}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
          >
            {t.common.back}
          </Link>
        </header>
        <EmptyState
          title={
            phase.reason === 'other-active-session'
              ? t.repasoSession.activeSessionTitle
              : phase.reason === 'no-questions'
                ? t.repasoSession.noQuestionsTitle
                : t.repasoSession.cannotStartTitle
          }
          description={
            phase.reason === 'other-active-session'
              ? t.repasoSession.activeSessionDescription
              : phase.reason === 'no-questions'
                ? t.repasoSession.noQuestionsDescription
                : t.repasoSession.cannotStartDescription
          }
          action={
            phase.reason === 'other-active-session' ? (
              <Link
                to="/app/timer"
                className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
              >
                {t.repasoSession.goToTimer}
              </Link>
            ) : (
              <Link
                to={`/app/repaso/${id ?? ''}`}
                className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
              >
                {t.repaso.backToRepaso}
              </Link>
            )
          }
        />
      </div>
    )
  }

  if (phase.kind === 'ended') {
    const total = stats.correct + stats.incorrect
    const percentage = total > 0 ? Math.round((stats.correct / total) * 100) : 0
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-6 text-center lg:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
            {t.repasoSession.summaryLabel}
          </p>
          <h1 className="text-3xl font-bold text-charcoal">
            {tpl(t.repasoSession.summaryScore, {
              correct: stats.correct,
              total,
            })}
          </h1>
          <p className="text-sm font-medium text-[color:var(--color-text-muted)]">
            {tpl(t.repasoSession.summaryPercentage, { percentage })}
          </p>
          <div className="mt-2 flex justify-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-pistachio/40 px-3 py-1 font-semibold text-charcoal">
              <Check size={12} aria-hidden="true" />
              {tpl(t.repasoSession.correctBadge, { count: stats.correct })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-apricot/20 px-3 py-1 font-semibold text-apricot">
              <X size={12} aria-hidden="true" />
              {tpl(t.repasoSession.incorrectBadge, { count: stats.incorrect })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-cream px-3 py-1 font-semibold text-charcoal ring-1 ring-[color:var(--color-border)]">
              <TimerIcon size={12} aria-hidden="true" />
              {formatDuration(elapsed)}
            </span>
          </div>
        </section>
        <button
          type="button"
          onClick={handleExit}
          className="w-full rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98]"
        >
          {t.repasoSession.exitToRepaso}
        </button>
      </div>
    )
  }

  // ---------------- answering / feedback ----------------
  const question = phase.question
  const isFeedback = phase.kind === 'feedback'
  const isCorrect = phase.kind === 'feedback' ? phase.isCorrect : false

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
      {/* Header + stats + finish: mobile on top, desktop sticky right sidebar. */}
      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-20 lg:p-5">
        <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-2">
          <div className="min-w-0 lg:w-full">
            <p className="truncate text-xs font-medium text-[color:var(--color-text-muted)]">
              {goal.name}
            </p>
            <p className="text-sm font-semibold text-charcoal">
              {t.repasoSession.header}
            </p>
          </div>
          <p
            className="text-xl font-bold text-charcoal tabular-nums lg:text-4xl"
            aria-live="polite"
          >
            {formatDuration(elapsed)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs font-semibold lg:flex-col lg:items-stretch lg:gap-2">
          <div className="flex items-center gap-2 lg:justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-pistachio/40 px-2 py-0.5 text-charcoal">
              <Check size={12} aria-hidden="true" />
              {stats.correct}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-apricot/20 px-2 py-0.5 text-apricot">
              <X size={12} aria-hidden="true" />
              {stats.incorrect}
            </span>
          </div>
          <button
            type="button"
            onClick={handleEnd}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-charcoal px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98] lg:py-2"
          >
            <Square size={12} aria-hidden="true" />
            {t.repasoSession.finish}
          </button>
        </div>
      </div>

      {/* Question + answers + confirm: mobile stacked, desktop left column. */}
      <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:max-w-2xl">
        <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 lg:p-6">
          <p className="whitespace-pre-wrap text-base font-semibold text-charcoal lg:text-lg">
            {question.prompt}
          </p>
          <QuestionMediaViewer
            imageBlobKey={question.imageBlobKey}
            audioBlobKey={question.audioBlobKey}
          />
        </section>

        <ul className="flex flex-col gap-2">
          {question.answers.map((answer) => {
            const chosen = chosenIds.includes(answer.id)
            const showAsCorrect = isFeedback && answer.isCorrect
            const showAsWrongPick = isFeedback && chosen && !answer.isCorrect
            return (
              <li key={answer.id}>
                <button
                  type="button"
                  onClick={() => toggleAnswer(answer.id)}
                  disabled={isFeedback}
                  aria-pressed={chosen}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition',
                    isFeedback && showAsCorrect
                      ? 'bg-pistachio/70 text-charcoal ring-1 ring-pistachio'
                      : isFeedback && showAsWrongPick
                        ? 'bg-apricot/20 text-charcoal ring-1 ring-apricot'
                        : chosen
                          ? 'bg-charcoal text-white'
                          : 'bg-surface text-charcoal ring-1 ring-[color:var(--color-border)]',
                  )}
                >
                  <span
                    className={clsx(
                      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                      isFeedback && showAsCorrect
                        ? 'bg-charcoal text-white'
                        : isFeedback && showAsWrongPick
                          ? 'bg-apricot text-white'
                          : chosen
                            ? 'bg-white text-charcoal'
                            : 'bg-cream text-[color:var(--color-text-muted)]',
                    )}
                  >
                    {isFeedback && showAsCorrect ? (
                      <Check size={14} aria-hidden="true" />
                    ) : isFeedback && showAsWrongPick ? (
                      <X size={14} aria-hidden="true" />
                    ) : chosen ? (
                      <Check size={14} aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{answer.text}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {isFeedback ? (
          <div
            className={clsx(
              'flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold',
              isCorrect
                ? 'bg-pistachio/60 text-charcoal'
                : 'bg-apricot/20 text-apricot',
            )}
          >
            <span>
              {isCorrect ? t.repasoSession.feedbackCorrect : t.repasoSession.feedbackIncorrect}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1 rounded-xl bg-charcoal px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
            >
              {t.repasoSession.nextQuestion}
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            {t.repasoSession.confirm}
          </button>
        )}
      </div>
    </div>
  )
}

export default RepasoSessionPage

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Save,
  Square,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { db } from '@/lib/db/miga-db'
import {
  discardExamAttempt,
  finishQuestionsExamAttempt,
  getExamElapsedMs,
  updateExamAttemptNotes,
} from '@/lib/db/exam-attempts.repository'
import { useQuestionsForAttempt } from '@/features/exams/hooks/use-questions-for-attempt'
import { buildQuestionNoteFields } from '@/features/exams/utils/question-to-note'
import { createNote } from '@/lib/db/notes.repository'
import { useElapsedTick } from '@/features/timer/hooks/use-elapsed-tick'
import QuestionMediaViewer from '@/features/questions/components/QuestionMediaViewer'
import { isAnswerCorrect } from '@/lib/srs/srs'
import { formatDuration } from '@/features/timer/utils'
import type { ExamAttempt, ExamResponse, Question } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'

function QuestionsExamSessionPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const { attemptId, id: goalId } = useParams<{ attemptId: string; id: string }>()
  const attempt = useLiveQuery(async () => {
    if (!attemptId) return null
    return (await db.examAttempts.get(attemptId)) ?? null
  }, [attemptId])
  const questions = useQuestionsForAttempt(attempt?.questionIds)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [chosenIds, setChosenIds] = useState<string[]>([])
  const [responses, setResponses] = useState<ExamResponse[]>([])
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const finishingRef = useRef(false)

  const isActive = attempt?.status === 'in-progress'
  const isCompleted = attempt?.status === 'completed'

  const now = useElapsedTick(isActive)
  const elapsed = attempt ? getExamElapsedMs(attempt, now) : 0

  const remainingMs =
    isActive && attempt?.timeLimitMs !== null && attempt?.timeLimitMs !== undefined
      ? Math.max(0, attempt.timeLimitMs - elapsed)
      : null
  const timeExpired = remainingMs !== null && remainingMs === 0

  const total = attempt?.questionIds?.length ?? 0
  const currentQuestion: Question | null = useMemo(() => {
    if (!isActive || !questions || questions.length === 0) return null
    return questions[currentIndex] ?? null
  }, [isActive, questions, currentIndex])

  const doFinish = useCallback(
    async (finalResponses: ExamResponse[]) => {
      if (!attempt || finishingRef.current) return
      finishingRef.current = true
      try {
        await finishQuestionsExamAttempt(attempt.id, { responses: finalResponses })
      } catch {
        finishingRef.current = false
        toast.error(t.examenes.questionsSession.cannotFinish)
      }
    },
    [attempt, t],
  )

  // Auto-finish when time expires: pad remaining questions with blank responses.
  useEffect(() => {
    if (!timeExpired || !attempt || !questions || finishingRef.current) return
    const answeredIds = new Set(responses.map((r) => r.questionId))
    const now = Date.now()
    const padded: ExamResponse[] = [
      ...responses,
      ...questions
        .filter((q) => !answeredIds.has(q.id))
        .map((q) => ({
          questionId: q.id,
          chosenAnswerIds: [],
          isCorrect: false,
          answeredAt: now,
        })),
    ]
    toast.info(t.examenes.questionsSession.timeUpToast)
    void doFinish(padded)
  }, [timeExpired, attempt, questions, responses, doFinish, t])

  if (attempt === undefined || (attempt && questions === undefined)) return <Loading />
  if (!attempt || !goalId) {
    return (
      <EmptyState
        title={t.examenes.session.notFoundTitle}
        description={t.examenes.session.notFoundDescription}
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

  const toggleAnswer = (answerId: string) => {
    if (!currentQuestion) return
    setChosenIds((prev) =>
      prev.includes(answerId) ? prev.filter((id) => id !== answerId) : [...prev, answerId],
    )
  }

  const handleConfirm = () => {
    if (!currentQuestion) return
    if (chosenIds.length === 0) {
      toast.error(t.examenes.questionsSession.selectAnswer)
      return
    }
    const isCorrect = isAnswerCorrect(currentQuestion, chosenIds)
    const response: ExamResponse = {
      questionId: currentQuestion.id,
      chosenAnswerIds: chosenIds,
      isCorrect,
      answeredAt: Date.now(),
    }
    const nextResponses = [...responses, response]
    setResponses(nextResponses)
    setChosenIds([])
    if (currentIndex + 1 >= total) {
      void doFinish(nextResponses)
    } else {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handleDiscard = async () => {
    try {
      await discardExamAttempt(attempt.id)
      toast.success(t.examenes.questionsSession.discarded)
      navigate(`/app/examenes/${goalId}`)
    } catch {
      toast.error(t.examenes.questionsSession.cannotDiscard)
    }
  }

  // ---------- Completed (results) ----------
  if (isCompleted) {
    return (
      <QuestionsExamResults
        attempt={attempt}
        questions={questions ?? []}
        elapsed={elapsed}
        goalId={goalId}
      />
    )
  }

  // ---------- Discarded ----------
  if (attempt.status === 'discarded') {
    return (
      <EmptyState
        title={t.examenes.questionsSession.discardedTitle}
        description={t.examenes.questionsSession.discardedDescription}
        action={
          <Link
            to={`/app/examenes/${goalId}`}
            className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
          >
            {t.examenes.backToGoal}
          </Link>
        }
      />
    )
  }

  // ---------- Active ----------
  if (!currentQuestion) {
    return (
      <EmptyState
        title={t.examenes.questionsSession.noQuestionsTitle}
        description={t.examenes.questionsSession.noQuestionsDescription}
        action={
          <Link
            to={`/app/examenes/${goalId}`}
            className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
          >
            {t.examenes.backToGoal}
          </Link>
        }
      />
    )
  }

  const questionNumber = currentIndex + 1

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Link
          to={`/app/examenes/${goalId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.examenes.backToGoal}
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        {/* Progress + timer card: mobile on top, desktop sticky right sidebar. */}
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-20 lg:p-5">
          <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-start lg:gap-2">
            <div className="min-w-0 lg:w-full">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
                {t.examenes.questionsSession.header}
              </p>
              <p className="mt-1 truncate text-base font-bold text-charcoal">
                {attempt.title}
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
                {tpl(t.examenes.questionsSession.progress, {
                  current: questionNumber,
                  total,
                })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 lg:w-full lg:items-start">
              <p
                className="text-xl font-bold text-charcoal tabular-nums lg:text-4xl"
                aria-live="polite"
              >
                {formatDuration(elapsed)}
              </p>
              {remainingMs !== null && (
                <p
                  className={clsx(
                    'text-[11px] font-semibold tabular-nums',
                    remainingMs < 60_000
                      ? 'text-apricot'
                      : 'text-[color:var(--color-text-muted)]',
                  )}
                >
                  {formatDuration(remainingMs)} {t.examenes.session.remaining}
                </p>
              )}
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-cream">
            <div
              className="h-full rounded-full bg-apricot transition-all"
              style={{ width: `${(questionNumber / total) * 100}%` }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={questionNumber}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowDiscardConfirm(true)}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-charcoal"
          >
            <Trash2 size={12} aria-hidden="true" />
            {t.examenes.questionsSession.discard}
          </button>
        </div>

        {/* Question + answers + confirm: mobile stacked, desktop left column. */}
        <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1 lg:max-w-2xl">
          <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 lg:p-6">
            <p className="whitespace-pre-wrap text-base font-semibold text-charcoal lg:text-lg">
              {currentQuestion.prompt}
            </p>
            <QuestionMediaViewer
              imageBlobKey={currentQuestion.imageBlobKey}
              audioBlobKey={currentQuestion.audioBlobKey}
            />
          </section>

          <ul className="flex flex-col gap-2">
            {currentQuestion.answers.map((answer) => {
              const chosen = chosenIds.includes(answer.id)
              return (
                <li key={answer.id}>
                  <button
                    type="button"
                    onClick={() => toggleAnswer(answer.id)}
                    aria-pressed={chosen}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition',
                      chosen
                        ? 'bg-charcoal text-white'
                        : 'bg-surface text-charcoal ring-1 ring-[color:var(--color-border)]',
                    )}
                  >
                    <span
                      className={clsx(
                        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                        chosen
                          ? 'bg-white text-charcoal'
                          : 'bg-cream text-[color:var(--color-text-muted)]',
                      )}
                    >
                      {chosen ? <Check size={14} aria-hidden="true" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{answer.text}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            {currentIndex + 1 >= total ? (
              <>
                <Square size={16} aria-hidden="true" />
                {t.examenes.questionsSession.finish}
              </>
            ) : (
              <>
                {t.examenes.questionsSession.next}
                <ChevronRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-3 sm:items-center">
          <div
            role="alertdialog"
            aria-modal="true"
            className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-apricot p-4 text-white shadow-lg"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} aria-hidden="true" />
              <p className="text-sm font-semibold">
                {t.examenes.questionsSession.discardTitle}
              </p>
            </div>
            <p className="text-xs opacity-90">
              {t.examenes.questionsSession.discardDescription}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-apricot transition active:scale-[0.98]"
              >
                {t.examenes.questionsSession.discardYes}
              </button>
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/40 transition active:scale-[0.98]"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionsExamResults({
  attempt,
  questions,
  elapsed,
  goalId,
}: {
  attempt: ExamAttempt
  questions: Question[]
  elapsed: number
  goalId: string
}) {
  const { t } = useT()
  const [notes, setNotes] = useState<string>(attempt.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [savedNoteIds, setSavedNoteIds] = useState<Set<string>>(() => new Set())
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null)

  const responses = attempt.responses ?? []
  const responsesByQuestion = useMemo(() => {
    const map = new Map<string, ExamResponse>()
    for (const r of responses) map.set(r.questionId, r)
    return map
  }, [responses])

  const handleSaveAsNote = async (question: Question) => {
    try {
      setSavingNoteId(question.id)
      const input = buildQuestionNoteFields({
        goalId: attempt.goalId,
        question,
        response: responsesByQuestion.get(question.id),
        examTitle: attempt.title,
        labels: t.examenes.questionsResult.noteBuilder,
      })
      await createNote(input)
      setSavedNoteIds((prev) => {
        const next = new Set(prev)
        next.add(question.id)
        return next
      })
      toast.success(t.examenes.questionsResult.saveAsNoteToast)
    } catch {
      toast.error(t.examenes.questionsResult.saveAsNoteError)
    } finally {
      setSavingNoteId(null)
    }
  }

  const score = attempt.score ?? 0
  const maxScore = attempt.maxScore ?? questions.length
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const wrong = questions.filter(
    (q) => !(responsesByQuestion.get(q.id)?.isCorrect ?? false),
  )
  const displayed = showAll ? questions : wrong

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true)
      await updateExamAttemptNotes(attempt.id, notes)
      toast.success(t.examenes.questionsResult.notesSaved)
    } catch {
      toast.error(t.examenes.questionsResult.cannotSaveNotes)
    } finally {
      setSavingNotes(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header>
        <Link
          to={`/app/examenes/${goalId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.examenes.backToGoal}
        </Link>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-6 text-center lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
          {t.examenes.questionsResult.summaryLabel}
        </p>
        <p className="truncate text-sm font-semibold text-charcoal">{attempt.title}</p>
        <h1 className="text-3xl font-bold text-charcoal lg:text-4xl">
          {tpl(t.examenes.questionsResult.summaryScore, { correct: score, total: maxScore })}
        </h1>
        <p className="text-sm font-medium text-[color:var(--color-text-muted)]">
          {tpl(t.examenes.questionsResult.summaryPercentage, { percentage })}
        </p>
        <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
          {formatDuration(elapsed)}
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
        <label htmlFor="results-notes" className="text-sm font-semibold text-charcoal">
          {t.examenes.questionsResult.notesLabel}
        </label>
        <textarea
          id="results-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.examenes.questionsResult.notesPlaceholder}
          rows={4}
          className="resize-none rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSaveNotes}
          disabled={savingNotes}
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-apricot px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          <Save size={14} aria-hidden="true" />
          {t.examenes.questionsResult.saveNotes}
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-charcoal">
            {showAll
              ? t.examenes.questionsResult.allQuestions
              : t.examenes.questionsResult.wrongAnswers}
          </h2>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-semibold text-apricot underline-offset-2 hover:underline"
          >
            {showAll
              ? t.examenes.questionsResult.showOnlyWrong
              : t.examenes.questionsResult.showAll}
          </button>
        </div>

        {displayed.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-3 text-xs text-[color:var(--color-text-muted)]">
            {t.examenes.questionsResult.emptyWrong}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {displayed.map((q) => {
              const response = responsesByQuestion.get(q.id)
              const originalIndex = questions.indexOf(q) + 1
              const isCorrect = response?.isCorrect ?? false
              const chosen = new Set(response?.chosenAnswerIds ?? [])
              return (
                <li
                  key={q.id}
                  className="flex flex-col gap-2 rounded-2xl bg-surface p-4 ring-1 ring-[color:var(--color-border)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[color:var(--color-text-muted)]">
                      {tpl(t.examenes.questionsResult.questionIndex, {
                        current: originalIndex,
                        total: questions.length,
                      })}
                    </p>
                    <span
                      className={clsx(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        isCorrect
                          ? 'bg-pistachio/60 text-charcoal'
                          : 'bg-apricot/20 text-apricot',
                      )}
                    >
                      {isCorrect ? (
                        <Check size={12} aria-hidden="true" />
                      ) : (
                        <X size={12} aria-hidden="true" />
                      )}
                      {isCorrect
                        ? t.examenes.questionsResult.correctBadge
                        : t.examenes.questionsResult.wrongBadge}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm font-semibold text-charcoal">
                    {q.prompt}
                  </p>
                  <QuestionMediaViewer
                    imageBlobKey={q.imageBlobKey}
                    audioBlobKey={q.audioBlobKey}
                  />
                  <ul className="flex flex-col gap-1.5">
                    {q.answers.map((a) => {
                      const wasChosen = chosen.has(a.id)
                      const showAsCorrect = a.isCorrect
                      const showAsWrongPick = wasChosen && !a.isCorrect
                      return (
                        <li
                          key={a.id}
                          className={clsx(
                            'flex items-center gap-2 rounded-xl px-3 py-2 text-xs',
                            showAsCorrect
                              ? 'bg-pistachio/50 text-charcoal ring-1 ring-pistachio'
                              : showAsWrongPick
                                ? 'bg-apricot/15 text-charcoal ring-1 ring-apricot'
                                : 'bg-cream text-charcoal',
                          )}
                        >
                          <span
                            className={clsx(
                              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                              showAsCorrect
                                ? 'bg-charcoal text-white'
                                : showAsWrongPick
                                  ? 'bg-apricot text-white'
                                  : 'bg-white/60 text-[color:var(--color-text-muted)]',
                            )}
                          >
                            {showAsCorrect ? (
                              <Check size={12} aria-hidden="true" />
                            ) : showAsWrongPick ? (
                              <X size={12} aria-hidden="true" />
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1 break-words font-medium">
                            {a.text}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  {!isCorrect && (
                    <button
                      type="button"
                      onClick={() => handleSaveAsNote(q)}
                      disabled={savingNoteId === q.id || savedNoteIds.has(q.id)}
                      className={clsx(
                        'inline-flex items-center justify-center gap-1.5 self-start rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-60',
                        savedNoteIds.has(q.id)
                          ? 'bg-pistachio/60 text-charcoal'
                          : 'bg-apricot text-white',
                      )}
                    >
                      {savedNoteIds.has(q.id) ? (
                        <>
                          <Check size={12} aria-hidden="true" />
                          {t.examenes.questionsResult.savedAsNote}
                        </>
                      ) : (
                        <>
                          <StickyNote size={12} aria-hidden="true" />
                          {t.examenes.questionsResult.saveAsNote}
                        </>
                      )}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default QuestionsExamSessionPage

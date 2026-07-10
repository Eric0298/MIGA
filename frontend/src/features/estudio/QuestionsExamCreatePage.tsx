import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Brain, Shuffle } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { useLiveGoal } from '@/features/goals/hooks/use-goal'
import { useQuestionsByGoal } from '@/features/questions/hooks/use-questions-by-goal'
import { startQuestionsExamAttempt } from '@/lib/db/exam-attempts.repository'
import { shuffle } from '@/lib/srs/srs'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'

type OrderMode = 'random' | 'original'

function QuestionsExamCreatePage() {
  const { t } = useT()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)
  const questions = useQuestionsByGoal(goal?.id)

  const totalAvailable = questions?.length ?? 0

  const [title, setTitle] = useState('')
  const [useAll, setUseAll] = useState(true)
  const [customCount, setCustomCount] = useState<string>('')
  const [order, setOrder] = useState<OrderMode>('random')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<string>('')
  const [creating, setCreating] = useState(false)

  const parsedCount = useMemo(() => {
    if (useAll) return totalAvailable
    const raw = parseInt(customCount, 10)
    if (!Number.isFinite(raw)) return NaN
    return raw
  }, [useAll, customCount, totalAvailable])

  const handleStart = async () => {
    if (!goal || !questions) return
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      toast.error(t.examenes.questionsCreate.errors.titleRequired)
      return
    }
    if (totalAvailable === 0) {
      toast.error(t.examenes.questionsCreate.errors.noQuestions)
      return
    }
    if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
      toast.error(t.examenes.questionsCreate.errors.invalidCount)
      return
    }
    if (parsedCount > totalAvailable) {
      toast.error(t.examenes.questionsCreate.errors.countTooHigh)
      return
    }
    let timeLimitMs: number | null = null
    if (timeLimitMinutes.trim().length > 0) {
      const minutes = parseFloat(timeLimitMinutes.replace(',', '.'))
      if (!Number.isFinite(minutes) || minutes <= 0) {
        toast.error(t.examenes.questionsCreate.errors.invalidTimeLimit)
        return
      }
      timeLimitMs = Math.round(minutes * 60_000)
    }
    try {
      setCreating(true)
      const ids = questions.map((q) => q.id)
      const ordered = order === 'random' ? shuffle(ids) : ids
      const picked = ordered.slice(0, parsedCount)
      const attempt = await startQuestionsExamAttempt({
        goalId: goal.id,
        title: trimmedTitle,
        questionIds: picked,
        timeLimitMs,
      })
      navigate(`/app/examenes/${goal.id}/preguntas/${attempt.id}`)
    } catch {
      toast.error(t.examenes.questionsCreate.errors.cannotStart)
    } finally {
      setCreating(false)
    }
  }

  if (goal === undefined || questions === undefined) return <Loading />
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

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to={`/app/examenes/${goal.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.examenes.backToGoal}
        </Link>
      </header>

      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-charcoal">
          {t.examenes.questionsCreate.title}
        </h1>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          {t.examenes.questionsCreate.subtitle}
        </p>
      </section>

      {totalAvailable === 0 ? (
        <EmptyState
          title={t.examenes.questionsCreate.noQuestionsTitle}
          description={t.examenes.questionsCreate.noQuestionsDescription}
          action={
            <Link
              to={`/app/repaso/${goal.id}`}
              className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
            >
              {t.examenes.questionsCreate.goToRepaso}
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="questions-exam-title"
              className="text-sm font-medium text-charcoal"
            >
              {t.examenes.questionsCreate.titleLabel}
            </label>
            <input
              id="questions-exam-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.examenes.questionsCreate.titlePlaceholder}
              maxLength={80}
              className="rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-charcoal">
              {t.examenes.questionsCreate.countLabel}
            </span>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {tpl(t.examenes.questionsCreate.countHint, { count: totalAvailable })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUseAll(true)}
                aria-pressed={useAll}
                className={clsx(
                  'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  useAll
                    ? 'bg-apricot text-white'
                    : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
                )}
              >
                {t.examenes.questionsCreate.useAll}
              </button>
              <button
                type="button"
                onClick={() => setUseAll(false)}
                aria-pressed={!useAll}
                className={clsx(
                  'flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  !useAll
                    ? 'bg-apricot text-white'
                    : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
                )}
              >
                {t.examenes.questionsCreate.useCustom}
              </button>
            </div>
            {!useAll && (
              <input
                id="questions-exam-count"
                type="number"
                min={1}
                max={totalAvailable}
                inputMode="numeric"
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                placeholder={String(Math.min(10, totalAvailable))}
                className="rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-charcoal">
              {t.examenes.questionsCreate.orderLabel}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOrder('random')}
                aria-pressed={order === 'random'}
                className={clsx(
                  'flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  order === 'random'
                    ? 'bg-apricot text-white'
                    : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
                )}
              >
                <Shuffle size={14} aria-hidden="true" />
                {t.examenes.questionsCreate.orderRandom}
              </button>
              <button
                type="button"
                onClick={() => setOrder('original')}
                aria-pressed={order === 'original'}
                className={clsx(
                  'flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition',
                  order === 'original'
                    ? 'bg-apricot text-white'
                    : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
                )}
              >
                <Brain size={14} aria-hidden="true" />
                {t.examenes.questionsCreate.orderOriginal}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="questions-exam-time"
              className="text-sm font-medium text-charcoal"
            >
              {t.examenes.questionsCreate.timeLimitLabel}
            </label>
            <input
              id="questions-exam-time"
              type="text"
              inputMode="decimal"
              value={timeLimitMinutes}
              onChange={(e) => setTimeLimitMinutes(e.target.value)}
              placeholder={t.examenes.questionsCreate.timeLimitPlaceholder}
              className="rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            />
            <p className="text-[11px] text-[color:var(--color-text-muted)]">
              {t.examenes.questionsCreate.timeLimitHint}
            </p>
          </div>

          <button
            type="button"
            onClick={handleStart}
            disabled={creating}
            className="w-full rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {t.examenes.questionsCreate.start}
          </button>
        </>
      )}
    </div>
  )
}

export default QuestionsExamCreatePage

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  ArrowLeft,
  Maximize2,
  Pause,
  Play,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { db } from '@/lib/db/miga-db'
import {
  discardExamAttempt,
  finishPdfExamAttempt,
  getExamElapsedMs,
  pauseExamAttempt,
  resumeExamAttempt,
} from '@/lib/db/exam-attempts.repository'
import { usePdfSourceBlobUrl } from '@/features/exams/hooks/use-pdf-source-blob-url'
import { useElapsedTick } from '@/features/timer/hooks/use-elapsed-tick'
import SimulacroGradeDialog from '@/features/exams/components/SimulacroGradeDialog'
import { formatDuration } from '@/features/timer/utils'
import { useT } from '@/i18n/i18n-context'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'

type FinishMode = null | 'ask' | 'grading'

function SimulacroSessionPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const { attemptId, id: goalId } = useParams<{ attemptId: string; id: string }>()
  const attempt = useLiveQuery(async () => {
    if (!attemptId) return null
    return (await db.examAttempts.get(attemptId)) ?? null
  }, [attemptId])
  const pdf = usePdfSourceBlobUrl(attempt?.pdfMaterialId, attempt?.pdfNoteId)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [finishMode, setFinishMode] = useState<FinishMode>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  const now = useElapsedTick(attempt?.status === 'in-progress')
  const elapsed = attempt ? getExamElapsedMs(attempt, now) : 0

  const remainingMs =
    attempt?.timeLimitMs !== null && attempt?.timeLimitMs !== undefined
      ? Math.max(0, attempt.timeLimitMs - elapsed)
      : null
  const timeExpired = remainingMs !== null && remainingMs === 0

  // Auto-open the finish dialog once the time limit runs out.
  useEffect(() => {
    if (timeExpired && finishMode === null && attempt?.status === 'in-progress') {
      setFinishMode('ask')
      toast.info(t.examenes.session.timeUpToast)
    }
  }, [timeExpired, finishMode, attempt?.status, t])

  if (attempt === undefined) return <Loading />
  if (attempt === null || !goalId) {
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

  const isActive = attempt.status === 'in-progress' || attempt.status === 'paused'
  const isPaused = attempt.status === 'paused'

  const handlePause = async () => {
    try {
      await pauseExamAttempt(attempt.id)
    } catch {
      toast.error(t.examenes.session.cannotPause)
    }
  }

  const handleResume = async () => {
    try {
      await resumeExamAttempt(attempt.id)
    } catch {
      toast.error(t.examenes.session.cannotResume)
    }
  }

  const handlePending = async () => {
    try {
      await finishPdfExamAttempt(attempt.id, { score: null, maxScore: null })
      toast.success(t.examenes.session.savedPending)
      navigate(`/app/examenes/${goalId}`)
    } catch {
      toast.error(t.examenes.session.cannotFinish)
    }
  }

  const handleDiscard = async () => {
    try {
      await discardExamAttempt(attempt.id)
      toast.success(t.examenes.session.discarded)
      navigate(`/app/examenes/${goalId}`)
    } catch {
      toast.error(t.examenes.session.cannotDiscard)
    }
  }

  const handleFullscreen = () => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    if (document.fullscreenElement === wrapper) {
      document.exitFullscreen().catch(() => undefined)
    } else {
      wrapper.requestFullscreen?.().catch(() => undefined)
    }
  }

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

      <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {t.examenes.session.header}
            </p>
            <p className="mt-1 truncate text-base font-bold text-charcoal">{attempt.title}</p>
            {isPaused && (
              <p className="mt-0.5 text-xs font-medium text-apricot">
                {t.examenes.session.pausedLabel}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <p
              className="text-xl font-bold text-charcoal tabular-nums"
              aria-live="polite"
            >
              {formatDuration(elapsed)}
            </p>
            {remainingMs !== null && (
              <p
                className={clsx(
                  'text-[11px] font-semibold tabular-nums',
                  remainingMs < 60_000 ? 'text-apricot' : 'text-[color:var(--color-text-muted)]',
                )}
              >
                {formatDuration(remainingMs)} {t.examenes.session.remaining}
              </p>
            )}
          </div>
        </div>

        {isActive && (
          <div className="flex flex-wrap gap-2">
            {isPaused ? (
              <button
                type="button"
                onClick={handleResume}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-apricot px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
              >
                <Play size={16} aria-hidden="true" />
                {t.examenes.session.resume}
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
              >
                <Pause size={16} aria-hidden="true" />
                {t.examenes.session.pause}
              </button>
            )}
            <button
              type="button"
              onClick={() => setFinishMode('ask')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-charcoal px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              <Square size={16} aria-hidden="true" />
              {t.examenes.session.finish}
            </button>
          </div>
        )}
        {isActive && (
          <button
            type="button"
            onClick={() => setShowDiscardConfirm(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-charcoal"
          >
            <Trash2 size={12} aria-hidden="true" />
            {t.examenes.session.discard}
          </button>
        )}
      </div>

      {/* --------- PDF viewer --------- */}
      <div
        ref={wrapperRef}
        className={clsx(
          'relative flex flex-col gap-2 rounded-2xl bg-charcoal p-2',
          document.fullscreenElement === wrapperRef.current && 'h-screen w-screen',
        )}
      >
        {pdf.status === 'loading' && (
          <p className="p-6 text-center text-xs text-white/80">{t.common.loading}</p>
        )}
        {pdf.status === 'error' && (
          <p className="p-6 text-center text-xs text-white/80">
            {t.examenes.session.pdfUnavailable}
          </p>
        )}
        {pdf.url && (
          <iframe
            src={pdf.url}
            title={attempt.title}
            className="h-[70vh] w-full rounded-xl bg-white"
          />
        )}
        <button
          type="button"
          onClick={handleFullscreen}
          aria-label={t.examenes.session.fullscreen}
          title={t.examenes.session.fullscreen}
          className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <Maximize2 size={16} aria-hidden="true" />
        </button>
      </div>

      {/* --------- Finish dialog --------- */}
      {finishMode === 'ask' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-3 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-surface p-4 shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                  {t.examenes.session.finishTitle}
                </p>
                <p className="mt-1 text-sm text-charcoal">
                  {t.examenes.session.finishDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFinishMode(null)}
                aria-label={t.common.cancel}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] hover:bg-cream hover:text-charcoal"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setFinishMode('grading')}
                className="rounded-2xl bg-apricot px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
              >
                {t.examenes.session.gradeNow}
              </button>
              <button
                type="button"
                onClick={handlePending}
                className="rounded-2xl bg-cream px-4 py-3 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
              >
                {t.examenes.session.leavePending}
              </button>
            </div>
          </div>
        </div>
      )}

      {finishMode === 'grading' && (
        <SimulacroGradeDialog
          attempt={attempt}
          mode="finish"
          onDone={() => {
            setFinishMode(null)
            navigate(`/app/examenes/${goalId}`)
          }}
          onCancel={() => setFinishMode(null)}
        />
      )}

      {/* --------- Discard confirm --------- */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-3 sm:items-center">
          <div
            role="alertdialog"
            aria-modal="true"
            className="flex w-full max-w-md flex-col gap-3 rounded-2xl bg-apricot p-4 text-white shadow-lg"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} aria-hidden="true" />
              <p className="text-sm font-semibold">{t.examenes.session.discardTitle}</p>
            </div>
            <p className="text-xs opacity-90">{t.examenes.session.discardDescription}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-apricot transition active:scale-[0.98]"
              >
                {t.examenes.session.discardYes}
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

export default SimulacroSessionPage

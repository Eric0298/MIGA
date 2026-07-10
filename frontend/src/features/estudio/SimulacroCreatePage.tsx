import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, FileText, StickyNote } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { useLiveGoal } from '@/features/goals/hooks/use-goal'
import {
  usePdfSourcesForGoal,
  type PdfSource,
} from '@/features/exams/hooks/use-pdf-sources-for-goal'
import { startPdfExamAttempt } from '@/lib/db/exam-attempts.repository'
import { useT } from '@/i18n/i18n-context'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'

function SimulacroCreatePage() {
  const { t } = useT()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)
  const sources = usePdfSourcesForGoal(goal?.id)

  const [title, setTitle] = useState('')
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<string>('')
  const [creating, setCreating] = useState(false)

  const picked = sources.find(
    (s) => `${s.kind}:${s.id}` === pickedKey,
  ) ?? null

  const handleStart = async () => {
    if (!goal) return
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      toast.error(t.examenes.create.errors.titleRequired)
      return
    }
    if (!picked) {
      toast.error(t.examenes.create.errors.sourceRequired)
      return
    }
    let timeLimitMs: number | null = null
    if (timeLimitMinutes.trim().length > 0) {
      const minutes = parseFloat(timeLimitMinutes.replace(',', '.'))
      if (!Number.isFinite(minutes) || minutes <= 0) {
        toast.error(t.examenes.create.errors.invalidTimeLimit)
        return
      }
      timeLimitMs = Math.round(minutes * 60_000)
    }
    try {
      setCreating(true)
      const attempt = await startPdfExamAttempt({
        goalId: goal.id,
        title: trimmedTitle,
        pdfMaterialId: picked.kind === 'material' ? picked.id : undefined,
        pdfNoteId: picked.kind === 'note' ? picked.id : undefined,
        timeLimitMs,
      })
      navigate(`/app/examenes/${goal.id}/simulacro/${attempt.id}`)
    } catch {
      toast.error(t.examenes.create.errors.cannotStart)
    } finally {
      setCreating(false)
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
        <h1 className="text-2xl font-bold text-charcoal">{t.examenes.create.title}</h1>
        <p className="text-sm text-[color:var(--color-text-muted)]">
          {t.examenes.create.subtitle}
        </p>
      </section>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="simulacro-title" className="text-sm font-medium text-charcoal">
          {t.examenes.create.titleLabel}
        </label>
        <input
          id="simulacro-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.examenes.create.titlePlaceholder}
          maxLength={80}
          className="rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-charcoal">
          {t.examenes.create.sourceLabel}
        </label>
        <p className="text-xs text-[color:var(--color-text-muted)]">
          {t.examenes.create.sourceHint}
        </p>
        {sources.length === 0 ? (
          <p className="rounded-xl bg-cream px-3 py-2 text-xs text-[color:var(--color-text-muted)] ring-1 ring-[color:var(--color-border)]">
            {t.examenes.create.sourceEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sources.map((source) => {
              const key = `${source.kind}:${source.id}`
              const active = pickedKey === key
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setPickedKey(key)}
                    aria-pressed={active}
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition',
                      active
                        ? 'bg-apricot text-white'
                        : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
                    )}
                  >
                    <SourceIcon source={source} active={active} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {source.label}
                      </span>
                      <span
                        className={clsx(
                          'text-[11px]',
                          active ? 'text-white/80' : 'text-[color:var(--color-text-muted)]',
                        )}
                      >
                        {source.kind === 'material'
                          ? t.examenes.create.fromMaterial
                          : t.examenes.create.fromNote}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="time-limit" className="text-sm font-medium text-charcoal">
          {t.examenes.create.timeLimitLabel}
        </label>
        <input
          id="time-limit"
          type="text"
          inputMode="decimal"
          value={timeLimitMinutes}
          onChange={(e) => setTimeLimitMinutes(e.target.value)}
          placeholder={t.examenes.create.timeLimitPlaceholder}
          className="rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
        />
        <p className="text-[11px] text-[color:var(--color-text-muted)]">
          {t.examenes.create.timeLimitHint}
        </p>
      </div>

      <button
        type="button"
        onClick={handleStart}
        disabled={creating || sources.length === 0}
        className="w-full rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {t.examenes.create.start}
      </button>
    </div>
  )
}

function SourceIcon({ source, active }: { source: PdfSource; active: boolean }) {
  const cls = clsx(
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
    active ? 'bg-white/20 text-white' : 'bg-peach text-charcoal',
  )
  return (
    <span className={cls}>
      {source.kind === 'material' ? (
        <FileText size={18} aria-hidden="true" />
      ) : (
        <StickyNote size={18} aria-hidden="true" />
      )}
    </span>
  )
}

export default SimulacroCreatePage

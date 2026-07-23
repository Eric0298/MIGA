import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  FileText,
  ImagePlus,
  Mic,
  Plus,
  StickyNote,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { startOfMonth, startOfWeek } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { listAllNotes } from '@/lib/db/notes.repository'
import type { Goal, NoteKind, NoteSource } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'
import NoteCard from '@/features/notes/components/NoteCard'
import NoteEditor from '@/features/notes/components/NoteEditor'

type DatePreset = 'all' | 'week' | 'month'
const ALL_SOURCES: readonly NoteSource[] = ['manual', 'session', 'exam'] as const

type CreateMode =
  | { kind: 'idle' }
  | { kind: 'picker' }
  | { kind: 'editor'; noteKind: NoteKind }

function NotasAllPage() {
  const { t } = useT()
  const notes = useLiveQuery(() => listAllNotes(), [])
  const goals = useLiveGoals()

  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([])
  const [selectedSources, setSelectedSources] = useState<NoteSource[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createMode, setCreateMode] = useState<CreateMode>({ kind: 'idle' })

  const goalsById = useMemo(() => {
    const map = new Map<string, Goal>()
    for (const g of goals ?? []) map.set(g.id, g)
    return map
  }, [goals])

  const filtered = useMemo(() => {
    if (!notes) return []
    const threshold =
      datePreset === 'week'
        ? startOfWeek(new Date(), { weekStartsOn: 1 }).getTime()
        : datePreset === 'month'
          ? startOfMonth(new Date()).getTime()
          : 0
    const goalSet = new Set(selectedGoalIds)
    const sourceSet = new Set(selectedSources)
    return notes.filter((n) => {
      if (n.updatedAt < threshold) return false
      if (goalSet.size > 0 && !n.goalIds.some((g) => goalSet.has(g))) return false
      if (sourceSet.size > 0 && !sourceSet.has(n.source)) return false
      return true
    })
  }, [notes, datePreset, selectedGoalIds, selectedSources])

  const toggleGoal = (id: string) => {
    setSelectedGoalIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    )
  }
  const toggleSource = (s: NoteSource) => {
    setSelectedSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }
  const clearFilters = () => {
    setDatePreset('all')
    setSelectedGoalIds([])
    setSelectedSources([])
  }

  const hasFilters =
    datePreset !== 'all' || selectedGoalIds.length > 0 || selectedSources.length > 0

  if (notes === undefined || goals === undefined) return <Loading />

  const editingNote = editingId ? notes.find((n) => n.id === editingId) ?? null : null
  const canAddNote = goals.length > 0
  const backToIdle = () => setCreateMode({ kind: 'idle' })

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/app/estudio"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.estudio.backToHub}
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-charcoal">{t.notasAll.title}</h1>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
              {t.notasAll.subtitle}
            </p>
          </div>
          {createMode.kind === 'idle' && canAddNote && (
            <button
              type="button"
              onClick={() => setCreateMode({ kind: 'picker' })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-apricot px-3 py-2 text-xs font-semibold text-white transition active:scale-[0.98]"
            >
              <Plus size={14} aria-hidden="true" />
              {t.apuntesHub.addNote}
            </button>
          )}
        </div>

        {createMode.kind === 'picker' && (
          <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
                {t.notes.picker.title}
              </p>
              <button
                type="button"
                onClick={backToIdle}
                aria-label={t.common.cancel}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <KindTile
                icon={<StickyNote size={18} aria-hidden="true" />}
                label={t.notes.picker.text}
                onClick={() => setCreateMode({ kind: 'editor', noteKind: 'text' })}
              />
              <KindTile
                icon={<Mic size={18} aria-hidden="true" />}
                label={t.notes.picker.voice}
                onClick={() => setCreateMode({ kind: 'editor', noteKind: 'voice' })}
              />
              <KindTile
                icon={<ImagePlus size={18} aria-hidden="true" />}
                label={t.notes.picker.image}
                onClick={() => setCreateMode({ kind: 'editor', noteKind: 'image' })}
              />
              <KindTile
                icon={<FileText size={18} aria-hidden="true" />}
                label={t.notes.picker.document}
                onClick={() => setCreateMode({ kind: 'editor', noteKind: 'document' })}
              />
            </div>
          </div>
        )}

        {createMode.kind === 'editor' && (
          <div className="rounded-2xl bg-surface p-4">
            <NoteEditor
              goalIds={[]}
              createKind={createMode.noteKind}
              onDone={backToIdle}
              onCancel={backToIdle}
            />
          </div>
        )}
      </section>

      {notes.length === 0 && createMode.kind === 'idle' ? (
        <EmptyState
          title={t.notasAll.emptyNoNotesTitle}
          description={t.notasAll.emptyNoNotesDescription}
        />
      ) : notes.length > 0 ? (
        <>
          <section
            aria-label={t.notasAll.filtersLabel}
            className="flex flex-col gap-3 rounded-2xl bg-surface p-4"
          >
            <FilterRow label={t.notasAll.dateLabel}>
              <PresetChip
                active={datePreset === 'all'}
                onClick={() => setDatePreset('all')}
              >
                {t.notasAll.dateAll}
              </PresetChip>
              <PresetChip
                active={datePreset === 'week'}
                onClick={() => setDatePreset('week')}
              >
                {t.notasAll.dateWeek}
              </PresetChip>
              <PresetChip
                active={datePreset === 'month'}
                onClick={() => setDatePreset('month')}
              >
                {t.notasAll.dateMonth}
              </PresetChip>
            </FilterRow>

            {goals.length > 0 && (
              <FilterRow label={t.notasAll.goalLabel}>
                {goals.map((g) => (
                  <PresetChip
                    key={g.id}
                    active={selectedGoalIds.includes(g.id)}
                    onClick={() => toggleGoal(g.id)}
                  >
                    <span className="max-w-[10rem] truncate">{g.name}</span>
                  </PresetChip>
                ))}
              </FilterRow>
            )}

            <FilterRow label={t.notasAll.sourceLabel}>
              {ALL_SOURCES.map((s) => (
                <PresetChip
                  key={s}
                  active={selectedSources.includes(s)}
                  onClick={() => toggleSource(s)}
                >
                  {sourceLabel(s, t)}
                </PresetChip>
              ))}
            </FilterRow>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="self-start text-xs font-semibold text-apricot underline decoration-dotted underline-offset-2"
              >
                {t.notasAll.clearFilters}
              </button>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              {tpl(
                filtered.length === 1
                  ? t.notasAll.resultsCountOne
                  : t.notasAll.resultsCountOther,
                { count: filtered.length },
              )}
            </p>
            {filtered.length === 0 ? (
              <p className="rounded-2xl bg-surface px-4 py-3 text-xs text-[color:var(--color-text-muted)]">
                {t.notasAll.emptyTitle} · {t.notasAll.emptyDescription}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {filtered.map((n) => (
                  <li key={n.id}>
                    <NoteCard
                      note={n}
                      onClick={() => setEditingId(n.id)}
                      goals={n.goalIds
                        .map((id) => goalsById.get(id))
                        .filter((g): g is Goal => Boolean(g))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {editingNote && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-charcoal/40 p-3 sm:items-center">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl bg-surface p-4">
            <NoteEditor
              goalIds={editingNote.goalIds}
              existingNoteId={editingNote.id}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
        {label}
      </span>
      <ul className="flex flex-wrap gap-1.5">{children}</ul>
    </div>
  )
}

function PresetChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={clsx(
          'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition',
          active
            ? 'bg-apricot text-white'
            : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)] hover:bg-peach',
        )}
      >
        {children}
      </button>
    </li>
  )
}

type KindTileProps = {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function KindTile({ icon, label, onClick }: KindTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl bg-cream px-2 py-3 text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98] hover:bg-peach"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-peach text-charcoal">
        {icon}
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  )
}

function sourceLabel(
  source: NoteSource,
  t: ReturnType<typeof useT>['t'],
): string {
  if (source === 'session') return t.notasAll.sourceSession
  if (source === 'exam') return t.notasAll.sourceExam
  return t.notasAll.sourceManual
}

export default NotasAllPage

import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'
import type { Material, Note } from '@/lib/db/schema'
import { useLiveGoal } from '@/features/goals/hooks/use-goal'
import { formatDuration, getElapsedMs } from '@/features/timer/utils'
import { useT } from '@/i18n/i18n-context'
import EmptyState from '@/components/ui/EmptyState'
import Loading from '@/components/ui/Loading'
import NoteCard from '@/features/notes/components/NoteCard'
import NoteEditor from '@/features/notes/components/NoteEditor'
import { useSessionById } from './hooks/use-session-by-id'

function SessionDetailPage() {
  const { t, locale } = useT()
  const { id } = useParams<{ id: string }>()
  const session = useSessionById(id)
  const goal = useLiveGoal(session?.goalId ?? undefined)

  const materials = useLiveQuery(async () => {
    if (!session || session.materialIds.length === 0) return [] as Material[]
    const rows = await db.materials.bulkGet(session.materialIds)
    return rows.filter((m): m is Material => Boolean(m))
  }, [session?.id, session?.materialIds])

  const notes = useLiveQuery(async () => {
    if (!session) return [] as Note[]
    return db.notes
      .where('sourceSessionId')
      .equals(session.id)
      .reverse()
      .sortBy('updatedAt')
  }, [session?.id])

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  if (session === undefined) return <Loading />
  if (!session) {
    return (
      <EmptyState
        title={t.sessions.detail.notFoundTitle}
        description={t.sessions.detail.notFoundDescription}
        action={
          <Link
            to="/app/sesiones"
            className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
          >
            {t.sessions.detail.backToSessions}
          </Link>
        }
      />
    )
  }

  const duration = getElapsedMs(session)
  const paused = session.totalPausedMs ?? 0
  const startedLabel = format(new Date(session.startedAt), "d 'de' LLL · HH:mm", {
    locale,
  })
  const endedLabel = session.endedAt
    ? format(new Date(session.endedAt), "d 'de' LLL · HH:mm", { locale })
    : ''

  const editingNote = editingNoteId
    ? (notes ?? []).find((n) => n.id === editingNoteId) ?? null
    : null

  const materialsSection = (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-charcoal">
        {t.sessions.detail.materialsSection}
      </h2>
      {materials === undefined ? (
        <p className="text-xs text-[color:var(--color-text-muted)]">
          {t.common.loading}
        </p>
      ) : materials.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-3 text-xs text-[color:var(--color-text-muted)]">
          {t.sessions.detail.materialsEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {materials.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-surface px-4 py-3 ring-1 ring-[color:var(--color-border)]"
            >
              <span className="truncate text-sm font-semibold text-charcoal">
                {m.title}
              </span>
              <span className="shrink-0 rounded-full bg-peach px-2 py-0.5 text-[11px] font-semibold text-charcoal">
                {m.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  const notesList = (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-charcoal">
        {t.sessions.detail.notesSection}
      </h2>
      {notes === undefined ? (
        <p className="text-xs text-[color:var(--color-text-muted)]">
          {t.common.loading}
        </p>
      ) : notes.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-3 text-xs text-[color:var(--color-text-muted)]">
          {t.sessions.detail.notesEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id}>
              <NoteCard note={n} onClick={() => setEditingNoteId(n.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/app/sesiones"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.sessions.detail.backToSessions}
        </Link>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 lg:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
          {t.sessions.detail.summaryLabel}
        </p>
        <h1 className="text-2xl font-bold text-charcoal lg:text-3xl">
          {goal ? goal.name : t.common.freeSession}
        </h1>
        <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          <SummaryStat
            label={t.sessions.detail.durationLabel}
            value={formatDuration(duration)}
            emphasis
          />
          <SummaryStat
            label={t.sessions.detail.pausedLabel}
            value={formatDuration(paused)}
          />
          <SummaryStat label={t.sessions.detail.startedLabel} value={startedLabel} />
          {endedLabel && (
            <SummaryStat label={t.sessions.detail.endedLabel} value={endedLabel} />
          )}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {materialsSection}
        <div className="flex flex-col gap-4">
          {notesList}
          {editingNote && (
            <div className="hidden rounded-2xl bg-surface p-5 lg:block">
              <NoteEditor
                goalIds={editingNote.goalIds}
                existingNoteId={editingNote.id}
                onDone={() => setEditingNoteId(null)}
                onCancel={() => setEditingNoteId(null)}
              />
            </div>
          )}
        </div>
      </div>

      {editingNote && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-charcoal/40 p-3 sm:items-center lg:hidden">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl bg-surface p-4">
            <NoteEditor
              goalIds={editingNote.goalIds}
              existingNoteId={editingNote.id}
              onDone={() => setEditingNoteId(null)}
              onCancel={() => setEditingNoteId(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? 'text-lg font-bold tabular-nums text-charcoal'
            : 'text-sm font-semibold tabular-nums text-charcoal'
        }
      >
        {value}
      </dd>
    </div>
  )
}

export default SessionDetailPage

import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, FileText, ImagePlus, Mic, Plus, StickyNote, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { db } from '@/lib/db/miga-db'
import { useT } from '@/i18n/i18n-context'
import type { NoteKind } from '@/lib/db/schema'
import NoteEditor from '@/features/notes/components/NoteEditor'
import GoalsBrowseGrid from './components/GoalsBrowseGrid'

type CreateMode =
  | { kind: 'idle' }
  | { kind: 'picker' }
  | { kind: 'editor'; noteKind: NoteKind }

function ApuntesPage() {
  const { t } = useT()
  const goals = useLiveGoals()
  const counts = useLiveQuery(async () => {
    const rows = await db.notes.toArray()
    const acc: Record<string, number> = {}
    for (const n of rows) {
      for (const gid of n.goalIds) {
        acc[gid] = (acc[gid] ?? 0) + 1
      }
    }
    return acc
  }, [])
  const [mode, setMode] = useState<CreateMode>({ kind: 'idle' })

  const backToIdle = () => setMode({ kind: 'idle' })
  const canAddNote = (goals?.length ?? 0) > 0

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
            <h1 className="text-2xl font-bold text-charcoal">{t.apuntesHub.title}</h1>
            <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
              {t.apuntesHub.subtitle}
            </p>
          </div>
          {mode.kind === 'idle' && canAddNote && (
            <button
              type="button"
              onClick={() => setMode({ kind: 'picker' })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-apricot px-3 py-2 text-xs font-semibold text-white transition active:scale-[0.98]"
            >
              <Plus size={14} aria-hidden="true" />
              {t.apuntesHub.addNote}
            </button>
          )}
        </div>

        {mode.kind === 'picker' && (
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
                onClick={() => setMode({ kind: 'editor', noteKind: 'text' })}
              />
              <KindTile
                icon={<Mic size={18} aria-hidden="true" />}
                label={t.notes.picker.voice}
                onClick={() => setMode({ kind: 'editor', noteKind: 'voice' })}
              />
              <KindTile
                icon={<ImagePlus size={18} aria-hidden="true" />}
                label={t.notes.picker.image}
                onClick={() => setMode({ kind: 'editor', noteKind: 'image' })}
              />
              <KindTile
                icon={<FileText size={18} aria-hidden="true" />}
                label={t.notes.picker.document}
                onClick={() => setMode({ kind: 'editor', noteKind: 'document' })}
              />
            </div>
          </div>
        )}

        {mode.kind === 'editor' && (
          <div className="rounded-2xl bg-surface p-4">
            <NoteEditor
              goalIds={[]}
              createKind={mode.noteKind}
              onDone={backToIdle}
              onCancel={backToIdle}
            />
          </div>
        )}

        {mode.kind === 'idle' &&
          (goals === undefined ? (
            <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
          ) : (
            <GoalsBrowseGrid
              goals={goals}
              counts={counts ?? {}}
              basePath="/app/apuntes"
              itemLabelOne={t.apuntesHub.notesCountOne}
              itemLabelOther={t.apuntesHub.notesCountOther}
              emptyGoalsTitle={t.apuntesHub.emptyGoalsTitle}
              emptyGoalsDescription={t.apuntesHub.emptyGoalsDescription}
            />
          ))}
      </section>
    </div>
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

export default ApuntesPage

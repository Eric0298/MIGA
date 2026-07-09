import { useState } from 'react'
import { FileText, ImagePlus, Mic, Plus, StickyNote, X } from 'lucide-react'
import { useT } from '@/i18n/i18n-context'
import type { NoteKind } from '@/lib/db/schema'
import { useNotesByGoal } from '../hooks/use-notes-by-goal'
import NoteCard from './NoteCard'
import NoteEditor from './NoteEditor'

type NotesPanelProps = {
  goalId: string
  sourceSessionId?: string | null
}

type PanelMode =
  | { kind: 'list' }
  | { kind: 'picker' }
  | { kind: 'create'; noteKind: NoteKind }
  | { kind: 'edit'; noteId: string }

function NotesPanel({ goalId, sourceSessionId = null }: NotesPanelProps) {
  const { t } = useT()
  const notes = useNotesByGoal(goalId) ?? []
  const [mode, setMode] = useState<PanelMode>({ kind: 'list' })

  const backToList = () => setMode({ kind: 'list' })
  const openPicker = () => setMode({ kind: 'picker' })
  const openCreate = (noteKind: NoteKind) => setMode({ kind: 'create', noteKind })
  const openEdit = (noteId: string) => setMode({ kind: 'edit', noteId })

  const isEditor = mode.kind === 'create' || mode.kind === 'edit'
  const createKind = mode.kind === 'create' ? mode.noteKind : undefined
  const editingId = mode.kind === 'edit' ? mode.noteId : undefined

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-charcoal">
          {t.notes.sectionTitle}
          {notes.length > 0 && (
            <span className="ml-2 text-xs font-normal text-[color:var(--color-text-muted)]">
              ({notes.length})
            </span>
          )}
        </h3>
        {mode.kind === 'list' && (
          <button
            type="button"
            onClick={openPicker}
            className="inline-flex items-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
          >
            <Plus size={14} aria-hidden="true" />
            {t.notes.new}
          </button>
        )}
        {mode.kind === 'picker' && (
          <button
            type="button"
            onClick={backToList}
            aria-label={t.common.cancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {mode.kind === 'picker' && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
            {t.notes.picker.title}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KindTile
              icon={<StickyNote size={18} aria-hidden="true" />}
              label={t.notes.picker.text}
              onClick={() => openCreate('text')}
            />
            <KindTile
              icon={<Mic size={18} aria-hidden="true" />}
              label={t.notes.picker.voice}
              onClick={() => openCreate('voice')}
            />
            <KindTile
              icon={<ImagePlus size={18} aria-hidden="true" />}
              label={t.notes.picker.image}
              onClick={() => openCreate('image')}
            />
            <KindTile
              icon={<FileText size={18} aria-hidden="true" />}
              label={t.notes.picker.document}
              onClick={() => openCreate('document')}
            />
          </div>
        </div>
      )}

      {mode.kind === 'list' && notes.length === 0 && (
        <p className="text-xs text-[color:var(--color-text-muted)]">{t.notes.empty}</p>
      )}

      {mode.kind === 'list' && notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} onClick={() => openEdit(note.id)} />
            </li>
          ))}
        </ul>
      )}

      {isEditor && (
        <NoteEditor
          goalId={goalId}
          sourceSessionId={sourceSessionId}
          existingNoteId={editingId}
          createKind={createKind}
          onDone={backToList}
          onCancel={backToList}
        />
      )}
    </section>
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

export default NotesPanel

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useT } from '@/i18n/i18n-context'
import { useNotesByGoal } from '../hooks/use-notes-by-goal'
import NoteCard from './NoteCard'
import NoteEditor from './NoteEditor'

type NotesPanelProps = {
  goalId: string
  sourceSessionId?: string | null
}

type PanelMode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; noteId: string }

function NotesPanel({ goalId, sourceSessionId = null }: NotesPanelProps) {
  const { t } = useT()
  const notes = useNotesByGoal(goalId) ?? []
  const [mode, setMode] = useState<PanelMode>({ kind: 'list' })

  const backToList = () => setMode({ kind: 'list' })
  const openCreate = () => setMode({ kind: 'create' })
  const openEdit = (noteId: string) => setMode({ kind: 'edit', noteId })

  const editingId = mode.kind === 'edit' ? mode.noteId : undefined
  const isEditor = mode.kind !== 'list'

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
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded-xl bg-apricot px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
          >
            <Plus size={14} aria-hidden="true" />
            {t.notes.new}
          </button>
        )}
      </div>

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
          onDone={backToList}
          onCancel={backToList}
        />
      )}
    </section>
  )
}

export default NotesPanel

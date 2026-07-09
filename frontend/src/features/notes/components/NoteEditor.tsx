import { useEffect, useState } from 'react'
import { getNote } from '@/lib/db/notes.repository'
import type { Note, NoteKind } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import TextNoteEditor from './TextNoteEditor'
import VoiceNoteEditor from './VoiceNoteEditor'
import ImageNoteEditor from './ImageNoteEditor'

type NoteEditorProps = {
  goalId: string
  sourceSessionId?: string | null
  existingNoteId?: string
  /** Kind requested when creating a new note. Ignored when editing an
   *  existing one (we read the kind from the loaded row). */
  createKind?: NoteKind
  onDone: () => void
  onCancel: () => void
}

/**
 * Routes editing / creation to the right per-kind editor. Text notes go
 * through TextNoteEditor, voice through VoiceNoteEditor, image through
 * ImageNoteEditor. Document notes (N4) will land here as another branch.
 */
function NoteEditor({
  goalId,
  sourceSessionId = null,
  existingNoteId,
  createKind = 'text',
  onDone,
  onCancel,
}: NoteEditorProps) {
  const { t } = useT()
  const [loaded, setLoaded] = useState<Note | null>(null)
  const [loading, setLoading] = useState(Boolean(existingNoteId))

  useEffect(() => {
    if (!existingNoteId) return
    let cancelled = false
    setLoading(true)
    getNote(existingNoteId)
      .then((note) => {
        if (!cancelled) setLoaded(note)
      })
      .catch(() => {
        if (!cancelled) setLoaded(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [existingNoteId])

  if (loading) {
    return (
      <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
    )
  }

  const kind: NoteKind = loaded?.kind ?? createKind

  if (kind === 'text') {
    return (
      <TextNoteEditor
        goalId={goalId}
        sourceSessionId={sourceSessionId}
        existing={loaded}
        onDone={onDone}
        onCancel={onCancel}
      />
    )
  }
  if (kind === 'voice') {
    return (
      <VoiceNoteEditor
        goalId={goalId}
        sourceSessionId={sourceSessionId}
        existing={loaded}
        onDone={onDone}
        onCancel={onCancel}
      />
    )
  }
  if (kind === 'image') {
    return (
      <ImageNoteEditor
        goalId={goalId}
        sourceSessionId={sourceSessionId}
        existing={loaded}
        onDone={onDone}
        onCancel={onCancel}
      />
    )
  }

  // document (N4) or any future kind falls back to a read-only placeholder.
  return (
    <div className="flex flex-col gap-3">
      {loaded && (
        <p className="text-sm font-semibold text-charcoal">{loaded.title}</p>
      )}
      <p className="text-xs text-[color:var(--color-text-muted)]">
        {t.notes.notEditableYet}
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
      >
        {t.common.back}
      </button>
    </div>
  )
}

export default NoteEditor

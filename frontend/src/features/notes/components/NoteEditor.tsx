import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import {
  createNote,
  deleteNote,
  getNote,
  updateNote,
} from '@/lib/db/notes.repository'
import { useT } from '@/i18n/i18n-context'

type NoteEditorProps = {
  goalId: string
  sourceSessionId?: string | null
  existingNoteId?: string
  onDone: () => void
  onCancel: () => void
}

/**
 * Editor for text notes. Voice and document notes have their own editors in
 * later iterations; here we handle text creation and text editing only.
 * Non-text existing notes render a read-only placeholder.
 */
function NoteEditor({
  goalId,
  sourceSessionId = null,
  existingNoteId,
  onDone,
  onCancel,
}: NoteEditorProps) {
  const { t } = useT()
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<'text' | 'voice' | 'document'>('text')
  const [loading, setLoading] = useState(Boolean(existingNoteId))
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!existingNoteId) return
    let cancelled = false
    getNote(existingNoteId)
      .then((note) => {
        if (cancelled || !note) return
        setKind(note.kind)
        setTitle(note.title)
        setText(note.text ?? '')
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [existingNoteId])

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      toast.error(t.notes.errors.titleRequired)
      return
    }
    if (trimmedTitle.length > 80) {
      toast.error(t.notes.errors.titleMax)
      return
    }
    if (text.trim().length === 0) {
      toast.error(t.notes.errors.textRequired)
      return
    }
    try {
      setSaving(true)
      if (existingNoteId) {
        await updateNote(existingNoteId, { title: trimmedTitle, text })
      } else {
        await createNote({
          goalId,
          kind: 'text',
          title: trimmedTitle,
          text,
          sourceSessionId: sourceSessionId ?? null,
        })
      }
      toast.success(t.notes.saved)
      onDone()
    } catch {
      toast.error(t.notes.cannotSave)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existingNoteId) return
    try {
      await deleteNote(existingNoteId)
      toast.success(t.notes.deleted)
      onDone()
    } catch {
      toast.error(t.notes.cannotDelete)
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
    )
  }

  if (existingNoteId && kind !== 'text') {
    // Voice / document notes are not editable in this iteration. Keep the
    // detail view minimal so users can see the title but nothing breaks.
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-charcoal">{title}</p>
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

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t.notes.titlePlaceholder}
        maxLength={80}
        className="rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.notes.textPlaceholder}
        rows={8}
        className="resize-none rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-2xl bg-apricot px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {t.notes.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
        >
          {t.common.cancel}
        </button>
      </div>
      {existingNoteId && !showDeleteConfirm && (
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="self-start text-xs font-medium text-apricot underline decoration-dotted underline-offset-2"
        >
          {t.notes.delete}
        </button>
      )}
      {showDeleteConfirm && (
        <div
          role="alertdialog"
          aria-labelledby="notes-delete-confirm-title"
          className="flex flex-col gap-2 rounded-xl bg-apricot p-3 text-white"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" />
            <p id="notes-delete-confirm-title" className="text-sm font-semibold">
              {t.notes.confirmDeleteTitle}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-apricot transition active:scale-[0.98]"
            >
              {t.notes.confirmDeleteYes}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/40 transition active:scale-[0.98]"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NoteEditor

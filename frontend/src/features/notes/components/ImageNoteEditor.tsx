import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ImagePlus } from 'lucide-react'
import {
  deleteNoteBlob,
  getNoteBlob,
  putNoteBlob,
  setNoteBlobOwner,
} from '@/lib/db/note-blobs.repository'
import { createNote, deleteNote, updateNote } from '@/lib/db/notes.repository'
import { NOTE_LIMITS, type Note } from '@/lib/db/schema'
import { formatBytes } from '@/lib/format-bytes'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import type { Messages } from '@/i18n/messages/es'

type ImageNoteEditorProps = {
  goalId: string
  sourceSessionId?: string | null
  existing?: Note | null
  onDone: () => void
  onCancel: () => void
}

const ALLOWED_MIMES = NOTE_LIMITS.image.mimeTypes
const MAX_BYTES = NOTE_LIMITS.image.maxBytes

function validateImageFile(file: File): 'fileInvalidType' | 'fileTooLarge' | null {
  if (!ALLOWED_MIMES.includes(file.type as (typeof ALLOWED_MIMES)[number])) {
    return 'fileInvalidType'
  }
  if (file.size > MAX_BYTES) return 'fileTooLarge'
  return null
}

function translateFileError(
  code: 'fileInvalidType' | 'fileTooLarge',
  errors: Messages['materials']['errors'],
): string {
  return errors[code]
}

function ImageNoteEditor({
  goalId,
  sourceSessionId = null,
  existing,
  onDone,
  onCancel,
}: ImageNoteEditorProps) {
  const { t } = useT()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [existingUrl, setExistingUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Load the existing image blob for preview.
  useEffect(() => {
    if (!existing?.fileBlobKey) return
    let cancelled = false
    let objectUrl: string | null = null
    ;(async () => {
      const record = await getNoteBlob(existing.fileBlobKey!).catch(() => null)
      if (cancelled || !record) return
      objectUrl = URL.createObjectURL(record.blob)
      setExistingUrl(objectUrl)
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [existing?.fileBlobKey])

  // Clean up the picked file preview.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    if (!picked) return
    const error = validateImageFile(picked)
    if (error) {
      setFileError(translateFileError(error, t.materials.errors))
      e.target.value = ''
      return
    }
    setFileError(null)
    setFile(picked)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(picked))
    if (title.trim().length === 0) {
      setTitle(picked.name.replace(/\.[^.]+$/, '').slice(0, 80))
    }
  }

  const handleSaveNew = async () => {
    if (!file) return
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      toast.error(t.notes.errors.titleRequired)
      return
    }
    let blobId: string | null = null
    try {
      setSaving(true)
      const record = await putNoteBlob({ blob: file, mimeType: file.type })
      blobId = record.id
      const note = await createNote({
        goalIds: [goalId],
        kind: 'image',
        title: trimmedTitle,
        fileBlobKey: blobId,
        metadata: {
          mimeType: file.type,
          fileSizeBytes: file.size,
          originalFilename: file.name,
        },
        sourceSessionId: sourceSessionId ?? null,
      })
      await setNoteBlobOwner(blobId, note.id)
      toast.success(t.notes.saved)
      onDone()
    } catch {
      if (blobId) {
        try {
          await deleteNoteBlob(blobId)
        } catch {
          // best-effort cleanup
        }
      }
      toast.error(t.notes.cannotSave)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveExisting = async () => {
    if (!existing) return
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      toast.error(t.notes.errors.titleRequired)
      return
    }
    try {
      setSaving(true)
      await updateNote(existing.id, { title: trimmedTitle })
      toast.success(t.notes.saved)
      onDone()
    } catch {
      toast.error(t.notes.cannotSave)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    try {
      await deleteNote(existing.id)
      toast.success(t.notes.deleted)
      onDone()
    } catch {
      toast.error(t.notes.cannotDelete)
    }
  }

  // --------- View existing image note ---------
  if (existing) {
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
        {existingUrl ? (
          <img
            src={existingUrl}
            alt={existing.title}
            className="max-h-[50vh] w-full rounded-xl object-contain ring-1 ring-black/5"
          />
        ) : (
          <p className="rounded-xl bg-cream px-3 py-2 text-xs text-[color:var(--color-text-muted)]">
            {t.common.loading}
          </p>
        )}
        <p className="text-xs text-[color:var(--color-text-muted)]">
          {t.notes.image.notEditable}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveExisting}
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
        {!showDeleteConfirm && (
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
            className="flex flex-col gap-2 rounded-xl bg-apricot p-3 text-white"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} aria-hidden="true" />
              <p className="text-sm font-semibold">{t.notes.confirmDeleteTitle}</p>
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

  // --------- Create new image note ---------
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
      <label
        htmlFor="image-note-file"
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
      >
        <ImagePlus size={16} aria-hidden="true" />
        {file
          ? tpl(t.materials.fileSelected, { name: file.name, size: formatBytes(file.size) })
          : t.notes.image.pickFile}
      </label>
      <input
        ref={fileInputRef}
        id="image-note-file"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />
      <p className="text-xs text-[color:var(--color-text-muted)]">
        {tpl(t.notes.image.hint, { max: formatBytes(MAX_BYTES) })}
      </p>
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          className="max-h-[50vh] w-full rounded-xl object-contain ring-1 ring-black/5"
        />
      )}
      {fileError && <p className="text-xs text-apricot">{fileError}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSaveNew}
          disabled={!file || saving}
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
    </div>
  )
}

export default ImageNoteEditor

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ExternalLink, FilePlus2, FileText } from 'lucide-react'
import {
  deleteNoteBlob,
  getNoteBlob,
  putNoteBlob,
  setNoteBlobOwner,
} from '@/lib/db/note-blobs.repository'
import {
  createNote,
  deleteNote,
  updateNote,
  type UpdateNotePatch,
} from '@/lib/db/notes.repository'
import { NOTE_LIMITS, type Note } from '@/lib/db/schema'
import { formatBytes } from '@/lib/format-bytes'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import type { Messages } from '@/i18n/messages/es'

type DocumentNoteEditorProps = {
  goalId: string
  sourceSessionId?: string | null
  existing?: Note | null
  onDone: () => void
  onCancel: () => void
}

const ALLOWED_MIMES = NOTE_LIMITS.document.mimeTypes
const MAX_BYTES = NOTE_LIMITS.document.maxBytes
const ACCEPT_ATTR =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const PDF_MIME = 'application/pdf'

function isPdfMime(mime: string | undefined): boolean {
  return mime === PDF_MIME
}

function shortMimeLabel(mime: string | undefined): string {
  if (mime === PDF_MIME) return 'PDF'
  if (mime === 'application/msword') return 'DOC'
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'DOCX'
  }
  return mime ?? ''
}

function validateDocumentFile(file: File): 'fileInvalidType' | 'fileTooLarge' | null {
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

function DocumentNoteEditor({
  goalId,
  sourceSessionId = null,
  existing,
  onDone,
  onCancel,
}: DocumentNoteEditorProps) {
  const { t } = useT()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [existingUrl, setExistingUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Load the existing blob as an object URL so we can preview PDFs inline and
  // hand the URL to the "Abrir" link for Word docs.
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

  // Revoke the picked-file preview when it changes or on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    if (!picked) return
    const error = validateDocumentFile(picked)
    if (error) {
      setFileError(translateFileError(error, t.materials.errors))
      e.target.value = ''
      return
    }
    setFileError(null)
    setFile(picked)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(picked))
    if (!existing && title.trim().length === 0) {
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
        kind: 'document',
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
    let newBlobId: string | null = null
    const oldBlobKey = existing.fileBlobKey
    try {
      setSaving(true)
      if (file) {
        const record = await putNoteBlob({ blob: file, mimeType: file.type })
        newBlobId = record.id
      }
      const patch: UpdateNotePatch = { title: trimmedTitle }
      if (newBlobId && file) {
        patch.fileBlobKey = newBlobId
        patch.metadata = {
          mimeType: file.type,
          fileSizeBytes: file.size,
          originalFilename: file.name,
        }
      }
      await updateNote(existing.id, patch)
      if (newBlobId) {
        await setNoteBlobOwner(newBlobId, existing.id)
        if (oldBlobKey) {
          try {
            await deleteNoteBlob(oldBlobKey)
          } catch {
            // orphan blob, but the note now points at the new one
          }
        }
      }
      toast.success(t.notes.saved)
      onDone()
    } catch {
      if (newBlobId) {
        try {
          await deleteNoteBlob(newBlobId)
        } catch {
          // ignore
        }
      }
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

  // --------- View existing document note ---------
  if (existing) {
    const existingMime = existing.metadata?.mimeType
    const existingName = existing.metadata?.originalFilename ?? existing.title
    const existingSize = existing.metadata?.fileSizeBytes
    const showPdfPreview = isPdfMime(existingMime) && existingUrl && !file
    const showNewPdfPreview = file && isPdfMime(file.type) && previewUrl

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

        <div className="flex items-start gap-3 rounded-xl bg-cream px-3 py-3 ring-1 ring-[color:var(--color-border)]">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-peach text-charcoal">
            <FileText size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-charcoal">{existingName}</p>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {shortMimeLabel(existingMime)}
              {existingSize !== undefined ? ` · ${formatBytes(existingSize)}` : ''}
            </p>
          </div>
          {existingUrl && (
            <a
              href={existingUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={existingName}
              className="inline-flex items-center gap-1 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
            >
              <ExternalLink size={12} aria-hidden="true" />
              {t.notes.document.open}
            </a>
          )}
        </div>

        {showPdfPreview && (
          <iframe
            src={existingUrl!}
            title={existing.title}
            className="h-[60vh] w-full rounded-xl bg-white ring-1 ring-black/10"
          />
        )}

        <label
          htmlFor="document-note-replace"
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
        >
          <FilePlus2 size={16} aria-hidden="true" />
          {file
            ? tpl(t.notes.document.newFileSelected, { name: file.name })
            : t.notes.document.replaceFile}
        </label>
        <input
          id="document-note-replace"
          type="file"
          accept={ACCEPT_ATTR}
          className="sr-only"
          onChange={handleFileChange}
        />
        <p className="text-xs text-[color:var(--color-text-muted)]">
          {tpl(t.notes.document.hint, { max: formatBytes(MAX_BYTES) })}
        </p>

        {showNewPdfPreview && (
          <iframe
            src={previewUrl!}
            title={file.name}
            className="h-[40vh] w-full rounded-xl bg-white ring-1 ring-black/10"
          />
        )}
        {fileError && <p className="text-xs text-apricot">{fileError}</p>}

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

  // --------- Create new document note ---------
  const showNewPdfPreviewCreate = file && isPdfMime(file.type) && previewUrl
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
        htmlFor="document-note-file"
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
      >
        <FilePlus2 size={16} aria-hidden="true" />
        {file
          ? tpl(t.materials.fileSelected, { name: file.name, size: formatBytes(file.size) })
          : t.notes.document.pickFile}
      </label>
      <input
        id="document-note-file"
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={handleFileChange}
      />
      <p className="text-xs text-[color:var(--color-text-muted)]">
        {tpl(t.notes.document.hint, { max: formatBytes(MAX_BYTES) })}
      </p>
      {showNewPdfPreviewCreate && (
        <iframe
          src={previewUrl!}
          title={file.name}
          className="h-[50vh] w-full rounded-xl bg-white ring-1 ring-black/10"
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

export default DocumentNoteEditor

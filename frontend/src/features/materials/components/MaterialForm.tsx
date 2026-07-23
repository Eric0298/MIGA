import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Loader2, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { createMaterial } from '@/lib/db/materials.repository'
import { deleteBlob, putBlob, setBlobMaterial } from '@/lib/db/blobs.repository'
import { MATERIAL_LIMITS, materialInputSchema, type MaterialKind } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import type { Messages } from '@/i18n/messages/es'
import { tpl } from '@/i18n/tpl'
import { formatShortDuration } from '@/features/timer/utils'
import { formatBytes } from '@/lib/format-bytes'
import { isProbablyYouTubeUrl } from '@/lib/api/youtube-metadata'
import { useYouTubeMetadata } from '../hooks/use-youtube-metadata'

type MaterialFormProps = {
  goalId: string
  onCreated?: () => void
  onCancel?: () => void
}

type FormKind = 'link' | 'note' | 'video-youtube' | 'video-upload' | 'pdf'

function translateSchemaError(key: string, errors: Messages['materials']['errors']): string {
  if (key in errors) return errors[key as keyof Messages['materials']['errors']]
  return key
}

function translateMetadataError(
  code: string | undefined,
  errors: Messages['materials']['errors'],
): string {
  switch (code) {
    case 'invalid_url':
      return errors.metadataInvalidUrl
    case 'video_not_found':
      return errors.metadataVideoNotFound
    case 'quota_exceeded':
      return errors.metadataQuotaExceeded
    case 'configuration_error':
      return errors.metadataConfigurationError
    case 'rate_limited':
      return errors.metadataRateLimited
    case 'service_unavailable':
      return errors.metadataServiceUnavailable
    case 'network_error':
      return errors.metadataNetworkError
    default:
      return errors.metadataUnknown
  }
}

function accepts(kind: FormKind): string | undefined {
  if (kind === 'pdf') return 'application/pdf'
  if (kind === 'video-upload') return 'video/*'
  return undefined
}

function validateFile(kind: FormKind, file: File): string | null {
  if (kind === 'pdf') {
    if (!MATERIAL_LIMITS.pdf.mimeTypes.includes(file.type as 'application/pdf')) {
      return 'fileInvalidType'
    }
    if (file.size > MATERIAL_LIMITS.pdf.maxBytes) return 'fileTooLarge'
    return null
  }
  if (kind === 'video-upload') {
    if (!file.type.startsWith(MATERIAL_LIMITS.videoUpload.mimeTypePrefix)) {
      return 'fileInvalidType'
    }
    if (file.size > MATERIAL_LIMITS.videoUpload.maxBytes) return 'fileTooLarge'
    return null
  }
  return null
}

function MaterialForm({ goalId, onCreated, onCancel }: MaterialFormProps) {
  const { t } = useT()
  const [kind, setKind] = useState<FormKind>('link')
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isYouTube = kind === 'video-youtube'
  const needsFile = kind === 'pdf' || kind === 'video-upload'
  const metadata = useYouTubeMetadata(url, { enabled: isYouTube })

  useEffect(() => {
    if (!isYouTube) return
    if (metadata.status !== 'success' || !metadata.data) return
    if (!titleTouched && title.trim().length === 0) {
      setTitle(metadata.data.title.slice(0, 80))
    }
  }, [isYouTube, metadata.status, metadata.data, titleTouched, title])

  useEffect(() => {
    setErrors({})
    if (!needsFile) {
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [kind, needsFile])

  const handleKindChange = (next: FormKind) => {
    setKind(next)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    if (!picked) {
      setFile(null)
      return
    }
    const error = validateFile(kind, picked)
    if (error) {
      setFile(null)
      setErrors((prev) => ({
        ...prev,
        fileBlobKey: t.materials.errors[error as 'fileInvalidType'],
      }))
      e.target.value = ''
      return
    }
    setErrors((prev) => {
      const rest = { ...prev }
      delete rest.fileBlobKey
      return rest
    })
    setFile(picked)
    if (!titleTouched && title.trim().length === 0) {
      setTitle(picked.name.replace(/\.[^.]+$/, '').slice(0, 80))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const kindForPayload: MaterialKind = kind
    const detected = metadata.status === 'success' ? metadata.data : null
    const trimmedUrl = url.trim()

    const payload = {
      kind: kindForPayload,
      title,
      url: kind === 'link' || kind === 'video-youtube' ? trimmedUrl : undefined,
      notes: kind === 'note' ? notes : undefined,
      fileBlobKey: needsFile && file ? 'pending' : undefined,
      metadata:
        kind === 'video-youtube' && detected
          ? {
              provider: 'youtube' as const,
              youtubeVideoId: detected.videoId,
              thumbnailUrl: detected.thumbnailUrl,
              author: detected.author,
              durationSeconds: detected.durationSeconds,
            }
          : needsFile && file
            ? {
                provider: kind === 'pdf' ? ('pdf' as const) : ('upload' as const),
                mimeType: file.type,
                fileSizeBytes: file.size,
              }
            : {},
    }

    const parsed = materialInputSchema.safeParse(payload)
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? 'title')
        next[field] = translateSchemaError(issue.message, t.materials.errors)
      }
      setErrors(next)
      return
    }

    let blobId: string | null = null
    try {
      setSubmitting(true)
      if (needsFile && file) {
        const record = await putBlob({ blob: file, mimeType: file.type })
        blobId = record.id
      }
      const material = await createMaterial({ ...parsed.data, fileBlobKey: blobId ?? undefined }, [
        goalId,
      ])
      if (blobId) {
        await setBlobMaterial(blobId, material.id)
      }
      toast.success(t.materials.created)
      onCreated?.()
    } catch {
      if (blobId) {
        try {
          await deleteBlob(blobId)
        } catch {
          // best-effort cleanup
        }
      }
      toast.error(t.materials.cannotCreate)
    } finally {
      setSubmitting(false)
    }
  }

  const showMetadataLoader = isYouTube && metadata.status === 'loading'
  const metadataError =
    isYouTube && metadata.status === 'error' && metadata.error
      ? translateMetadataError(metadata.error.code, t.materials.errors)
      : null
  const detected = metadata.status === 'success' ? metadata.data : null
  const urlLooksLikeYouTube = isProbablyYouTubeUrl(url)

  const fileHint =
    kind === 'pdf'
      ? tpl(t.materials.fileHintPdf, { max: formatBytes(MATERIAL_LIMITS.pdf.maxBytes) })
      : kind === 'video-upload'
        ? tpl(t.materials.fileHintVideo, {
            max: formatBytes(MATERIAL_LIMITS.videoUpload.maxBytes),
          })
        : ''

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl bg-surface p-5"
      noValidate
    >
      <div>
        <p className="text-sm font-medium text-charcoal">{t.materials.kindLabel}</p>
        <div
          role="tablist"
          aria-label={t.materials.kindLabel}
          className="mt-2 grid grid-cols-3 gap-2"
        >
          <KindTab
            active={kind === 'link'}
            label={t.materials.kindLink}
            onClick={() => handleKindChange('link')}
          />
          <KindTab
            active={kind === 'note'}
            label={t.materials.kindNote}
            onClick={() => handleKindChange('note')}
          />
          <KindTab
            active={kind === 'video-youtube'}
            label={t.materials.kindVideo}
            onClick={() => handleKindChange('video-youtube')}
          />
          <KindTab
            active={kind === 'video-upload'}
            label={t.materials.kindVideoUpload}
            onClick={() => handleKindChange('video-upload')}
          />
          <KindTab
            active={kind === 'pdf'}
            label={t.materials.kindPdf}
            onClick={() => handleKindChange('pdf')}
          />
        </div>
      </div>

      {(kind === 'link' || kind === 'video-youtube') && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="material-url" className="text-sm font-medium text-charcoal">
            {t.materials.url}
          </label>
          <input
            id="material-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="rounded-xl bg-cream px-4 py-3 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            placeholder={
              kind === 'video-youtube'
                ? t.materials.youtubeUrlPlaceholder
                : t.materials.urlPlaceholder
            }
          />
          {errors.url && <p className="text-xs text-apricot">{errors.url}</p>}
          {isYouTube && url.trim().length > 0 && !urlLooksLikeYouTube && (
            <p className="text-xs text-apricot">{t.materials.errors.metadataInvalidUrl}</p>
          )}
          {showMetadataLoader && (
            <p className="inline-flex items-center gap-1.5 text-xs text-[color:var(--color-text-muted)]">
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              {t.materials.fetchingMetadata}
            </p>
          )}
          {metadataError && <p className="text-xs text-apricot">{metadataError}</p>}
        </div>
      )}

      {isYouTube && detected && (
        <div className="flex gap-3 rounded-xl bg-cream p-3">
          <img
            src={detected.thumbnailUrl}
            alt=""
            width={96}
            height={54}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-[54px] w-[96px] shrink-0 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
              {t.materials.detectedFrom}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-charcoal">{detected.title}</p>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {detected.author}
              {detected.durationSeconds > 0 && (
                <>
                  {' · '}
                  {formatShortDuration(detected.durationSeconds * 1000)}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {needsFile && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="material-file" className="text-sm font-medium text-charcoal">
            {t.materials.fileLabel}
          </label>
          <label
            htmlFor="material-file"
            className="inline-flex items-center gap-2 rounded-xl bg-cream px-4 py-3 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] cursor-pointer transition active:scale-[0.98]"
          >
            <Paperclip size={16} aria-hidden="true" />
            {file
              ? tpl(t.materials.fileSelected, { name: file.name, size: formatBytes(file.size) })
              : t.materials.filePick}
          </label>
          <input
            ref={fileInputRef}
            id="material-file"
            type="file"
            accept={accepts(kind)}
            className="sr-only"
            onChange={handleFileChange}
          />
          <p className="text-xs text-[color:var(--color-text-muted)]">{fileHint}</p>
          {errors.fileBlobKey && <p className="text-xs text-apricot">{errors.fileBlobKey}</p>}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="material-title" className="text-sm font-medium text-charcoal">
          {t.materials.title}
        </label>
        <input
          id="material-title"
          type="text"
          autoComplete="off"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setTitleTouched(true)
          }}
          maxLength={80}
          className="rounded-xl bg-cream px-4 py-3 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
          placeholder={t.materials.titlePlaceholder}
        />
        {errors.title && <p className="text-xs text-apricot">{errors.title}</p>}
      </div>

      {kind === 'note' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="material-notes" className="text-sm font-medium text-charcoal">
            {t.materials.notes}
          </label>
          <textarea
            id="material-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            className="resize-none rounded-xl bg-cream px-4 py-3 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            placeholder={t.materials.notesPlaceholder}
          />
          {errors.notes && <p className="text-xs text-apricot">{errors.notes}</p>}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {t.materials.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl bg-cream px-5 py-3 text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
        >
          {t.materials.cancel}
        </button>
      </div>
    </form>
  )
}

type KindTabProps = {
  active: boolean
  label: string
  onClick: () => void
}

function KindTab({ active, label, onClick }: KindTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        'rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
        active
          ? 'bg-charcoal text-white'
          : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
      )}
    >
      {label}
    </button>
  )
}

export default MaterialForm

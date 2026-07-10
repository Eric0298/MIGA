import { useEffect, useState } from 'react'
import { getQuestionBlob } from '@/lib/db/question-blobs.repository'
import { useT } from '@/i18n/i18n-context'

type QuestionMediaViewerProps = {
  imageBlobKey?: string
  audioBlobKey?: string
}

/**
 * Loads and displays the optional image/audio attached to a question prompt.
 * Used from the review flow (view-only). URLs are revoked when the keys
 * change or the component unmounts.
 */
function QuestionMediaViewer({ imageBlobKey, audioBlobKey }: QuestionMediaViewerProps) {
  const { t } = useT()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!imageBlobKey) return
    let cancelled = false
    let objectUrl: string | null = null
    ;(async () => {
      const record = await getQuestionBlob(imageBlobKey).catch(() => null)
      if (cancelled || !record) return
      objectUrl = URL.createObjectURL(record.blob)
      setImageUrl(objectUrl)
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setImageUrl(null)
    }
  }, [imageBlobKey])

  useEffect(() => {
    if (!audioBlobKey) return
    let cancelled = false
    let objectUrl: string | null = null
    ;(async () => {
      const record = await getQuestionBlob(audioBlobKey).catch(() => null)
      if (cancelled || !record) return
      objectUrl = URL.createObjectURL(record.blob)
      setAudioUrl(objectUrl)
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setAudioUrl(null)
    }
  }, [audioBlobKey])

  if (!imageBlobKey && !audioBlobKey) return null

  return (
    <div className="flex flex-col gap-2">
      {imageBlobKey && (
        imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="max-h-64 w-full rounded-xl object-contain ring-1 ring-black/5"
          />
        ) : (
          <p className="text-xs text-[color:var(--color-text-muted)]">{t.common.loading}</p>
        )
      )}
      {audioBlobKey && (
        audioUrl ? (
          <audio src={audioUrl} controls preload="metadata" className="w-full" />
        ) : (
          <p className="text-xs text-[color:var(--color-text-muted)]">{t.common.loading}</p>
        )
      )}
    </div>
  )
}

export default QuestionMediaViewer

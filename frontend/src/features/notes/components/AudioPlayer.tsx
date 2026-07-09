import { useEffect, useState } from 'react'
import { getNoteBlob } from '@/lib/db/note-blobs.repository'
import { useT } from '@/i18n/i18n-context'

type AudioPlayerProps = {
  blobId: string
}

/**
 * Loads a voice-note blob from Dexie and hands the object URL to a native
 * <audio controls> element. Cleans the URL up when the id changes or the
 * component unmounts.
 */
function AudioPlayer({ blobId }: AudioPlayerProps) {
  const { t } = useT()
  const [url, setUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setStatus('loading')
    ;(async () => {
      try {
        const record = await getNoteBlob(blobId)
        if (cancelled) return
        if (!record) {
          setStatus('error')
          return
        }
        objectUrl = URL.createObjectURL(record.blob)
        setUrl(objectUrl)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [blobId])

  if (status === 'loading') {
    return (
      <p className="text-xs text-[color:var(--color-text-muted)]">{t.common.loading}</p>
    )
  }
  if (status === 'error' || !url) {
    return (
      <p className="rounded-xl bg-cream px-3 py-2 text-xs text-[color:var(--color-text-muted)] ring-1 ring-[color:var(--color-border)]">
        {t.notes.voice.audioUnavailable}
      </p>
    )
  }
  return <audio src={url} controls preload="metadata" className="w-full" />
}

export default AudioPlayer

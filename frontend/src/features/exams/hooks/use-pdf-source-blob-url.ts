import { useEffect, useState } from 'react'
import { resolvePdfSourceBlob } from './use-pdf-sources-for-goal'

/**
 * Loads a PDF Blob for either a Material (kind='pdf') or a Note (kind='document'
 * with PDF mime) and returns a live object URL. The URL is revoked when the
 * source changes or the component unmounts.
 */
export function usePdfSourceBlobUrl(
  materialId: string | undefined,
  noteId: string | undefined,
): { url: string | null; status: 'loading' | 'ready' | 'error' | 'idle' } {
  const [url, setUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'idle'>(
    materialId || noteId ? 'loading' : 'idle',
  )

  useEffect(() => {
    if (!materialId && !noteId) {
      setStatus('idle')
      setUrl(null)
      return
    }
    let cancelled = false
    let objectUrl: string | null = null
    setStatus('loading')
    ;(async () => {
      const blob = await resolvePdfSourceBlob(materialId, noteId).catch(() => null)
      if (cancelled) return
      if (!blob) {
        setStatus('error')
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
      setStatus('ready')
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [materialId, noteId])

  return { url, status }
}

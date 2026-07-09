import { useEffect, useState } from 'react'
import {
  fetchYouTubeMetadata,
  isProbablyYouTubeUrl,
  type YouTubeMetadata,
  type YouTubeMetadataError,
} from '@/lib/api/youtube-metadata'

export type YouTubeMetadataStatus = 'idle' | 'loading' | 'success' | 'error'

export type UseYouTubeMetadataState = {
  status: YouTubeMetadataStatus
  data: YouTubeMetadata | null
  error: YouTubeMetadataError | null
}

const DEFAULT_DEBOUNCE_MS = 800

export function useYouTubeMetadata(
  url: string,
  options: { enabled?: boolean; debounceMs?: number } = {},
): UseYouTubeMetadataState {
  const { enabled = true, debounceMs = DEFAULT_DEBOUNCE_MS } = options
  const [state, setState] = useState<UseYouTubeMetadataState>({
    status: 'idle',
    data: null,
    error: null,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', data: null, error: null })
      return
    }
    const trimmed = url.trim()
    if (!isProbablyYouTubeUrl(trimmed)) {
      setState({ status: 'idle', data: null, error: null })
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState((prev) => ({ ...prev, status: 'loading' }))
      try {
        const result = await fetchYouTubeMetadata(trimmed, controller.signal)
        if (controller.signal.aborted) return
        if (result.success) {
          setState({ status: 'success', data: result.data, error: null })
        } else {
          setState({ status: 'error', data: null, error: result.error })
        }
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setState({
          status: 'error',
          data: null,
          error: { code: 'network_error', message: 'network_error' },
        })
      }
    }, debounceMs)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [url, enabled, debounceMs])

  return state
}

import { useEffect, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import { getBlob } from '@/lib/db/blobs.repository'
import { MEDIA_PLAYER_STATE, type MediaPlayer, type MediaPlayerState } from '@/lib/api/media-player'

type LocalVideoPlayerProps = {
  blobId: string
  onReady?: (player: MediaPlayer) => void
  onStateChange?: (state: MediaPlayerState) => void
  onError?: (code: number) => void
  fullscreenLabel?: string
}

function LocalVideoPlayer({
  blobId,
  onReady,
  onStateChange,
  onError,
  fullscreenLabel = 'Fullscreen',
}: LocalVideoPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const onReadyRef = useRef(onReady)
  const onStateChangeRef = useRef(onStateChange)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onReadyRef.current = onReady
    onStateChangeRef.current = onStateChange
    onErrorRef.current = onError
  })

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setStatus('loading')
    ;(async () => {
      try {
        const record = await getBlob(blobId)
        if (cancelled) return
        if (!record) {
          setStatus('error')
          onErrorRef.current?.(404)
          return
        }
        objectUrl = URL.createObjectURL(record.blob)
        setSrc(objectUrl)
      } catch {
        if (!cancelled) {
          setStatus('error')
          onErrorRef.current?.(500)
        }
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setSrc(null)
    }
  }, [blobId])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const player: MediaPlayer = {
      getCurrentTime: () => video.currentTime,
      getPlayerState: () => {
        if (video.ended) return MEDIA_PLAYER_STATE.ENDED
        if (video.paused) return MEDIA_PLAYER_STATE.PAUSED
        if (video.seeking || video.readyState < 3) return MEDIA_PLAYER_STATE.BUFFERING
        return MEDIA_PLAYER_STATE.PLAYING
      },
      playVideo: () => {
        video.play().catch(() => undefined)
      },
      pauseVideo: () => video.pause(),
    }

    const handleLoadedMetadata = () => {
      setStatus('ready')
      onReadyRef.current?.(player)
    }
    const handlePlay = () => onStateChangeRef.current?.(MEDIA_PLAYER_STATE.PLAYING)
    const handlePause = () => onStateChangeRef.current?.(MEDIA_PLAYER_STATE.PAUSED)
    const handleEnded = () => onStateChangeRef.current?.(MEDIA_PLAYER_STATE.ENDED)
    const handleError = () => {
      setStatus('error')
      onErrorRef.current?.(video.error?.code ?? 0)
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
    }
  }, [src])

  const handleFullscreen = () => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    if (document.fullscreenElement === wrapper) {
      document.exitFullscreen().catch(() => undefined)
    } else {
      wrapper.requestFullscreen?.().catch(() => undefined)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-charcoal"
    >
      {src && (
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full bg-charcoal"
        />
      )}
      <button
        type="button"
        onClick={handleFullscreen}
        aria-label={fullscreenLabel}
        title={fullscreenLabel}
        className="absolute top-2 right-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black/60 text-white transition-colors hover:bg-black/80"
      >
        <Maximize2 size={16} aria-hidden="true" />
      </button>
      {status === 'error' && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-charcoal text-center text-xs text-white/80">
          <span>Player unavailable</span>
        </div>
      )}
    </div>
  )
}

export default LocalVideoPlayer

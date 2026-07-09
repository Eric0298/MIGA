import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import {
  bindYouTubePlayer,
  buildYouTubeEmbedUrl,
  YT_PLAYER_STATE,
  type YouTubePlayerInstance,
  type YouTubePlayerState,
} from '@/lib/api/youtube-iframe-api'

export type YouTubePlayerHandle = {
  play: () => void
  pause: () => void
  getPlayer: () => YouTubePlayerInstance | null
}

type YouTubePlayerProps = {
  videoId: string
  onStateChange?: (state: YouTubePlayerState) => void
  onError?: (code: number) => void
  onReady?: (player: YouTubePlayerInstance) => void
  fullscreenLabel?: string
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  function YouTubePlayer(
    { videoId, onStateChange, onError, onReady, fullscreenLabel = 'Fullscreen' },
    ref,
  ) {
    const wrapperRef = useRef<HTMLDivElement>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const playerRef = useRef<YouTubePlayerInstance | null>(null)
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

    // Callbacks in refs so a parent re-render never triggers a player rebuild.
    const onReadyRef = useRef(onReady)
    const onStateChangeRef = useRef(onStateChange)
    const onErrorRef = useRef(onError)
    useEffect(() => {
      onReadyRef.current = onReady
      onStateChangeRef.current = onStateChange
      onErrorRef.current = onError
    })

    useImperativeHandle(
      ref,
      () => ({
        play: () => playerRef.current?.playVideo(),
        pause: () => playerRef.current?.pauseVideo(),
        getPlayer: () => playerRef.current,
      }),
      [],
    )

    useEffect(() => {
      const guard = { cancelled: false }
      const iframe = iframeRef.current
      if (!iframe) return

      setStatus('loading')

      bindYouTubePlayer(iframe, {
        onReady: (player) => {
          if (guard.cancelled) return
          playerRef.current = player
          setStatus('ready')
          onReadyRef.current?.(player)
        },
        onStateChange: (state) => {
          if (guard.cancelled) return
          onStateChangeRef.current?.(state)
        },
        onError: (code) => {
          if (guard.cancelled) return
          setStatus('error')
          onErrorRef.current?.(code)
        },
      }).catch(() => {
        if (!guard.cancelled) setStatus('error')
      })

      // NOTE: intentionally do NOT call playerRef.current?.destroy() here.
      // YT.Player.destroy() removes the iframe from the DOM, which conflicts
      // with React reconciliation. In StrictMode's dev double-mount this
      // eats the iframe before the second bind can attach → black player.
      // When the component truly unmounts, React removes the iframe itself
      // and the YT.Player instance becomes unreachable / GC-eligible.
      return () => {
        guard.cancelled = true
        playerRef.current = null
      }
    }, [videoId])

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
        <iframe
          key={videoId}
          ref={iframeRef}
          id={`yt-${videoId}`}
          src={buildYouTubeEmbedUrl(videoId)}
          title="YouTube video"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; encrypted-media; picture-in-picture; autoplay"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
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
  },
)

export default YouTubePlayer
export { YT_PLAYER_STATE }
export type { YouTubePlayerState }

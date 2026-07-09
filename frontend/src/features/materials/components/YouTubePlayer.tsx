import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import {
  createYouTubePlayer,
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
    const targetRef = useRef<HTMLDivElement>(null)
    const playerRef = useRef<YouTubePlayerInstance | null>(null)
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

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
      let cancelled = false
      const target = targetRef.current
      if (!target) return

      setStatus('loading')

      createYouTubePlayer(target, videoId, {
        onReady: (player) => {
          if (cancelled) {
            player.destroy()
            return
          }
          playerRef.current = player
          const wrapper = wrapperRef.current
          const iframe = wrapper?.querySelector('iframe')
          if (iframe) {
            iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin')
            iframe.setAttribute('allow', 'fullscreen; encrypted-media; picture-in-picture')
          }
          setStatus('ready')
          onReady?.(player)
        },
        onStateChange: (state) => {
          if (cancelled) return
          onStateChange?.(state)
        },
        onError: (code) => {
          if (cancelled) return
          setStatus('error')
          onError?.(code)
        },
      }).catch(() => {
        if (!cancelled) setStatus('error')
      })

      return () => {
        cancelled = true
        try {
          playerRef.current?.destroy()
        } catch {
          // ignore
        }
        playerRef.current = null
      }
    }, [videoId, onReady, onStateChange, onError])

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
        <div ref={targetRef} className="absolute inset-0 h-full w-full" />
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
          <div className="absolute inset-0 z-0 flex items-center justify-center bg-charcoal text-center text-xs text-white/80">
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

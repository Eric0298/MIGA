/**
 * Minimal shape of the YouTube IFrame Player API pieces we actually use.
 * Kept private to this module so the rest of the app never touches window.YT.
 */

export const YT_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export type YouTubePlayerState = (typeof YT_PLAYER_STATE)[keyof typeof YT_PLAYER_STATE]

export type YouTubePlayerInstance = {
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): YouTubePlayerState
  destroy(): void
}

export type YouTubePlayerEvents = {
  onReady?: (player: YouTubePlayerInstance) => void
  onStateChange?: (state: YouTubePlayerState) => void
  onError?: (code: number) => void
}

type YTNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId?: string
      host?: string
      playerVars?: Record<string, unknown>
      events?: {
        onReady?: (event: { target: YouTubePlayerInstance }) => void
        onStateChange?: (event: { data: number }) => void
        onError?: (event: { data: number }) => void
      }
    },
  ) => YouTubePlayerInstance
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_URL = 'https://www.youtube.com/iframe_api'

let loadPromise: Promise<YTNamespace> | null = null

/**
 * Loads the YouTube IFrame API script once and returns the shared namespace.
 * Safe to call from multiple components concurrently.
 */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('YouTube IFrame API requires a browser'))
      return
    }

    if (window.YT?.Player) {
      resolve(window.YT)
      return
    }

    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.()
      if (window.YT?.Player) {
        resolve(window.YT)
      } else {
        reject(new Error('YouTube IFrame API loaded without YT.Player'))
      }
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${API_URL}"]`)
    if (existing) return

    const script = document.createElement('script')
    script.src = API_URL
    script.async = true
    script.onerror = () => reject(new Error('Failed to load YouTube IFrame API'))
    document.head.appendChild(script)
  })

  return loadPromise
}

/**
 * Builds the embed URL for youtube-nocookie.com with our default player options
 * and the JS API bridge enabled. Consumers can drop this into a hand-rolled
 * <iframe src=""> and later hand that iframe to bindYouTubePlayer.
 */
export function buildYouTubeEmbedUrl(videoId: string): string {
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : ''
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    fs: '1',
    playsinline: '1',
  })
  if (origin) {
    params.set('origin', origin)
    params.set('widget_referrer', origin)
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`
}

/**
 * Binds YT.Player to an existing iframe. The iframe must already point at the
 * embed URL with enablejsapi=1 (use buildYouTubeEmbedUrl). Because we own the
 * iframe element, we keep control of sandbox / referrerpolicy / positioning
 * and avoid the layout/parpadeo issues of the default YT.Player(div) mode.
 */
export function bindYouTubePlayer(
  iframe: HTMLIFrameElement,
  events: YouTubePlayerEvents,
): Promise<YouTubePlayerInstance> {
  return loadYouTubeIframeApi().then((YT) => {
    return new Promise<YouTubePlayerInstance>((resolve, reject) => {
      try {
        new YT.Player(iframe, {
          events: {
            onReady: (event) => {
              events.onReady?.(event.target)
              resolve(event.target)
            },
            onStateChange: (event) => {
              events.onStateChange?.(event.data as YouTubePlayerState)
            },
            onError: (event) => {
              events.onError?.(event.data)
            },
          },
        })
      } catch (cause) {
        reject(cause instanceof Error ? cause : new Error('Unknown player error'))
      }
    })
  })
}

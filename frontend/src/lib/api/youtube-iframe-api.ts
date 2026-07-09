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
      videoId: string
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
 * Creates a Player instance bound to the given container element.
 * The container is replaced by the YouTube iframe managed by YT.Player.
 */
export function createYouTubePlayer(
  container: HTMLElement,
  videoId: string,
  events: YouTubePlayerEvents,
): Promise<YouTubePlayerInstance> {
  return loadYouTubeIframeApi().then((YT) => {
    return new Promise<YouTubePlayerInstance>((resolve, reject) => {
      try {
        const player = new YT.Player(container, {
          videoId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            rel: 0,
            modestbranding: 1,
            fs: 1,
            playsinline: 1,
          },
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
        void player
      } catch (cause) {
        reject(cause instanceof Error ? cause : new Error('Unknown player error'))
      }
    })
  })
}

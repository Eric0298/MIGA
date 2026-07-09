/**
 * Shared player abstraction so useVideoTracker can measure watched time on
 * any source (YouTube iframe, local HTMLVideoElement, future providers).
 *
 * State values intentionally mirror YouTube's IFrame API constants so YT
 * players and local adapters emit the same numbers.
 */

export const MEDIA_PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export type MediaPlayerState = (typeof MEDIA_PLAYER_STATE)[keyof typeof MEDIA_PLAYER_STATE]

export type MediaPlayer = {
  getCurrentTime(): number
  getPlayerState(): MediaPlayerState
  playVideo(): void
  pauseVideo(): void
}

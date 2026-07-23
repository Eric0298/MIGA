import { useCallback, useEffect, useRef } from 'react'
import { MEDIA_PLAYER_STATE, type MediaPlayer } from '@/lib/api/media-player'
import type { VideoRange } from '@/lib/db/schema'
import { mergeRanges } from '../utils/merge-ranges'

const TICK_MS = 500
const SEEK_THRESHOLD_SECONDS = 1.5

export type VideoTrackerSnapshot = {
  totalWatchedMs: number
  ranges: VideoRange[]
  startedAt: number
  endedAt: number
}

/**
 * Tracks real watched time on a YouTube player instance.
 *
 * A single always-on interval samples getPlayerState() and getCurrentTime()
 * every TICK_MS. When the player is PLAYING, it extends the active range
 * and increments the watched total. When it isn't, it closes the range.
 *
 * Polling instead of relying on onStateChange keeps us robust to slow /
 * missed events (common when YT.Player is bound to a pre-existing iframe).
 */
export function useVideoTracker(playerRef: { current: MediaPlayer | null }) {
  const activeRangeRef = useRef<VideoRange | null>(null)
  const closedRangesRef = useRef<VideoRange[]>([])
  const totalWatchedMsRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      const player = playerRef.current
      if (!player) return

      let state: number
      let current: number
      try {
        state = player.getPlayerState()
        current = player.getCurrentTime()
      } catch {
        return
      }

      if (state !== MEDIA_PLAYER_STATE.PLAYING) {
        if (activeRangeRef.current) {
          closedRangesRef.current.push(activeRangeRef.current)
          activeRangeRef.current = null
        }
        return
      }

      if (!Number.isFinite(current)) return
      startedAtRef.current ??= Date.now()

      const active = activeRangeRef.current
      if (active === null) {
        activeRangeRef.current = [current, current]
        return
      }
      const delta = current - active[1]
      if (delta >= 0 && delta <= SEEK_THRESHOLD_SECONDS) {
        active[1] = current
        totalWatchedMsRef.current += TICK_MS
      } else {
        closedRangesRef.current.push(active)
        activeRangeRef.current = [current, current]
      }
    }, TICK_MS)

    return () => window.clearInterval(id)
  }, [playerRef])

  // Kept for API compatibility (TimerVideoSession forwards state changes
  // through this for the timer/video sync). Tracking no longer depends on
  // it firing.
  const handleStateChange = useCallback((_state: number) => {
    void _state
  }, [])

  const snapshot = useCallback((): VideoTrackerSnapshot => {
    const closed = closedRangesRef.current.slice()
    if (activeRangeRef.current) {
      closed.push(activeRangeRef.current)
    }
    return {
      totalWatchedMs: totalWatchedMsRef.current,
      ranges: mergeRanges(closed),
      startedAt: startedAtRef.current ?? Date.now(),
      endedAt: Date.now(),
    }
  }, [])

  const reset = useCallback(() => {
    activeRangeRef.current = null
    closedRangesRef.current = []
    totalWatchedMsRef.current = 0
    startedAtRef.current = null
  }, [])

  return { handleStateChange, snapshot, reset }
}

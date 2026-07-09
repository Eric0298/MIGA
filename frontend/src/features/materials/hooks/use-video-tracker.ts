import { useCallback, useEffect, useRef } from 'react'
import { YT_PLAYER_STATE, type YouTubePlayerInstance } from '@/lib/api/youtube-iframe-api'
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
 * Every TICK_MS while the player is PLAYING it samples getCurrentTime() and
 * accumulates seen ranges. Big forward/backward jumps between ticks are
 * treated as seeks: the current active range is closed and a new one starts.
 *
 * Consumers get a `snapshot()` helper that returns the current running
 * totals (with the active range merged in), safe to call at any time.
 */
export function useVideoTracker(playerRef: { current: YouTubePlayerInstance | null }) {
  const activeRangeRef = useRef<VideoRange | null>(null)
  const closedRangesRef = useRef<VideoRange[]>([])
  const totalWatchedMsRef = useRef(0)
  const startedAtRef = useRef<number | null>(null)
  const timerIdRef = useRef<number | null>(null)

  const stopTicker = useCallback(() => {
    if (timerIdRef.current !== null) {
      clearInterval(timerIdRef.current)
      timerIdRef.current = null
    }
    if (activeRangeRef.current) {
      closedRangesRef.current.push(activeRangeRef.current)
      activeRangeRef.current = null
    }
  }, [])

  const startTicker = useCallback(() => {
    if (timerIdRef.current !== null) return
    startedAtRef.current ??= Date.now()

    timerIdRef.current = window.setInterval(() => {
      const player = playerRef.current
      if (!player) return
      try {
        const current = player.getCurrentTime()
        if (!Number.isFinite(current)) return
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
      } catch {
        // Player was destroyed underneath us; stop trying.
        stopTicker()
      }
    }, TICK_MS)
  }, [playerRef, stopTicker])

  const handleStateChange = useCallback(
    (state: number) => {
      if (state === YT_PLAYER_STATE.PLAYING) {
        startTicker()
      } else {
        stopTicker()
      }
    },
    [startTicker, stopTicker],
  )

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
    stopTicker()
    closedRangesRef.current = []
    totalWatchedMsRef.current = 0
    startedAtRef.current = null
  }, [stopTicker])

  useEffect(() => {
    return () => {
      stopTicker()
    }
  }, [stopTicker])

  return { handleStateChange, snapshot, reset }
}

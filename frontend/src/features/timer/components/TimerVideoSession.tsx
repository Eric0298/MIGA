import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Pause, Play, Square, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Session } from '@/lib/db/schema'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { useMaterial } from '@/features/materials/hooks/use-material'
import {
  discardSession,
  pauseSession,
  resumeSession,
  stopSession,
} from '@/lib/db/sessions.repository'
import { createMaterialProgress } from '@/lib/db/material-progress.repository'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import { useSyncTimerVideo } from '@/lib/settings/player-prefs'
import { formatDuration, formatShortDuration, getElapsedMs } from '../utils'
import { useElapsedTick } from '../hooks/use-elapsed-tick'
import YouTubePlayer, {
  YT_PLAYER_STATE,
  type YouTubePlayerState,
} from '@/features/materials/components/YouTubePlayer'
import { useVideoTracker } from '@/features/materials/hooks/use-video-tracker'
import type { YouTubePlayerInstance } from '@/lib/api/youtube-iframe-api'

type TimerVideoSessionProps = {
  session: Session
}

function TimerVideoSession({ session }: TimerVideoSessionProps) {
  const { t } = useT()
  const goals = useLiveGoals()
  const material = useMaterial(session.materialId)
  const goal = goals?.find((g) => g.id === session.goalId) ?? null
  const now = useElapsedTick(session.status === 'running')
  const elapsed = getElapsedMs(session, now)
  const isPaused = session.status === 'paused'
  const [syncEnabled] = useSyncTimerVideo()

  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const tracker = useVideoTracker(playerRef)
  const trackerSnapshotRef = useRef(tracker.snapshot)
  const persistedRef = useRef(false)

  useEffect(() => {
    trackerSnapshotRef.current = tracker.snapshot
  }, [tracker.snapshot])

  const persistProgress = useCallback(async () => {
    if (persistedRef.current) return
    if (!session.materialId || !material) return
    const snap = trackerSnapshotRef.current()
    if (snap.totalWatchedMs <= 0 && snap.ranges.length === 0) {
      persistedRef.current = true
      return
    }
    persistedRef.current = true
    try {
      await createMaterialProgress({
        materialId: session.materialId,
        goalId: session.goalId,
        sessionId: session.id,
        kind: material.kind,
        totalWatchedMs: snap.totalWatchedMs,
        videoRanges: snap.ranges,
        startedAt: snap.startedAt,
        endedAt: snap.endedAt,
      })
    } catch {
      // silent — the session has already been stopped
    }
  }, [session.id, session.materialId, session.goalId, material])

  const handlePlayerReady = useCallback((player: YouTubePlayerInstance) => {
    playerRef.current = player
  }, [])

  const handlePlayerStateChange = useCallback(
    (state: YouTubePlayerState) => {
      tracker.handleStateChange(state)
      if (!syncEnabled) return
      // Asymmetric sync: play resumes the timer, but pausing the video does
      // NOT pause the timer (pausing may just mean the user is taking notes,
      // which is still study time).
      if (state === YT_PLAYER_STATE.PLAYING && session.status === 'paused') {
        resumeSession(session.id).catch(() => undefined)
      }
    },
    [tracker, syncEnabled, session.id, session.status],
  )

  const handlePause = async () => {
    try {
      await pauseSession(session.id)
      if (syncEnabled) playerRef.current?.pauseVideo()
    } catch {
      toast.error(t.timer.cannotPause)
    }
  }

  const handleResume = async () => {
    try {
      await resumeSession(session.id)
      if (syncEnabled) playerRef.current?.playVideo()
    } catch {
      toast.error(t.timer.cannotResume)
    }
  }

  const handleStop = async () => {
    try {
      const snap = trackerSnapshotRef.current()
      const watchedMs = snap.totalWatchedMs
      const notesMs = Math.max(0, elapsed - watchedMs)
      await persistProgress()
      if (syncEnabled) playerRef.current?.pauseVideo()
      await stopSession(session.id)
      if (watchedMs > 0) {
        toast.success(
          tpl(t.timer.sessionSavedBreakdown, {
            video: formatShortDuration(watchedMs),
            notes: formatShortDuration(notesMs),
          }),
        )
      } else {
        toast.success(t.timer.sessionSaved)
      }
    } catch {
      toast.error(t.timer.cannotStop)
    }
  }

  const handleDiscard = async () => {
    try {
      persistedRef.current = true // do not create progress for a discarded session
      if (syncEnabled) playerRef.current?.pauseVideo()
      await discardSession(session.id)
      toast.success(t.timer.sessionDiscarded)
    } catch {
      toast.error(t.timer.cannotDiscard)
    }
  }

  useEffect(() => {
    return () => {
      void persistProgress()
    }
  }, [persistProgress])

  const videoId = useMemo(() => material?.metadata?.youtubeVideoId, [material])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[color:var(--color-text-muted)]">
              {goal ? goal.name : t.common.freeSession}
            </p>
            <p className="truncate text-sm font-semibold text-charcoal">
              {material?.title ?? ''}
            </p>
            {isPaused && (
              <p className="mt-0.5 text-xs font-medium text-apricot">{t.timer.paused}</p>
            )}
          </div>
          <p
            className="text-2xl font-bold text-charcoal tabular-nums"
            aria-live="polite"
          >
            {formatDuration(elapsed)}
          </p>
        </div>
        <div className="mt-3 flex gap-2">
          {isPaused ? (
            <button
              type="button"
              onClick={handleResume}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-apricot px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
            >
              <Play size={16} aria-hidden="true" />
              {t.timer.resume}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePause}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
            >
              <Pause size={16} aria-hidden="true" />
              {t.timer.pause}
            </button>
          )}
          <button
            type="button"
            onClick={handleStop}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-charcoal px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <Square size={16} aria-hidden="true" />
            {t.timer.stop}
          </button>
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-charcoal"
        >
          <Trash2 size={12} aria-hidden="true" />
          {t.timer.discard}
        </button>
      </div>

      {videoId ? (
        <YouTubePlayer
          videoId={videoId}
          onReady={handlePlayerReady}
          onStateChange={handlePlayerStateChange}
          fullscreenLabel={t.timer.videoFullscreen}
        />
      ) : (
        <p className="rounded-2xl bg-surface p-5 text-sm text-[color:var(--color-text-muted)]">
          {t.materials.errors.metadataInvalidUrl}
        </p>
      )}
    </div>
  )
}

export default TimerVideoSession

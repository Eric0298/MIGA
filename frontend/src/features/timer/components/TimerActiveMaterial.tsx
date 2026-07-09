import { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Material, Session } from '@/lib/db/schema'
import { createMaterialProgress } from '@/lib/db/material-progress.repository'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import YouTubePlayer from '@/features/materials/components/YouTubePlayer'
import LocalVideoPlayer from '@/features/materials/components/LocalVideoPlayer'
import { useVideoTracker } from '@/features/materials/hooks/use-video-tracker'
import { type MediaPlayer, type MediaPlayerState } from '@/lib/api/media-player'
import Loading from '@/components/ui/Loading'
import { getElapsedMs } from '../utils'

const PdfViewer = lazy(() => import('@/features/materials/components/PdfViewer'))

type TimerActiveMaterialProps = {
  session: Session
  material: Material
  onPlayerStateChange?: (state: MediaPlayerState) => void
}

function TimerActiveMaterial({ session, material, onPlayerStateChange }: TimerActiveMaterialProps) {
  const { t } = useT()
  const playerRef = useRef<MediaPlayer | null>(null)
  const tracker = useVideoTracker(playerRef)
  const trackerSnapshotRef = useRef(tracker.snapshot)
  const persistedRef = useRef(false)
  const elapsedAtStartRef = useRef(getElapsedMs(session, Date.now()))
  const sessionRef = useRef(session)
  const pagesReadRef = useRef<Set<number>>(new Set())
  const pagesReadCountsRef = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    trackerSnapshotRef.current = tracker.snapshot
  }, [tracker.snapshot])

  const handlePageRead = useCallback((page: number) => {
    pagesReadRef.current.add(page)
    pagesReadCountsRef.current.set(
      page,
      (pagesReadCountsRef.current.get(page) ?? 0) + 1,
    )
  }, [])

  const persistProgress = useCallback(async () => {
    if (persistedRef.current) return
    persistedRef.current = true
    const currentSession = sessionRef.current
    if (currentSession.status === 'discarded') return

    const isVideo = material.kind === 'video-youtube' || material.kind === 'video-upload'
    const isPdf = material.kind === 'pdf'
    const snap = trackerSnapshotRef.current()
    const now = Date.now()
    const currentElapsed = getElapsedMs(currentSession, now)
    const activeElapsed = Math.max(0, currentElapsed - elapsedAtStartRef.current)

    const totalWatchedMs = isVideo ? snap.totalWatchedMs : activeElapsed
    const videoRanges = isVideo ? snap.ranges : undefined
    const pagesRead = isPdf && pagesReadRef.current.size > 0
      ? Array.from(pagesReadRef.current).sort((a, b) => a - b)
      : undefined
    const pagesReadCounts = isPdf && pagesReadCountsRef.current.size > 0
      ? Object.fromEntries(
          Array.from(pagesReadCountsRef.current.entries()).map(([page, count]) => [
            String(page),
            count,
          ]),
        )
      : undefined
    const startedAt = isVideo ? snap.startedAt : now - activeElapsed
    const endedAt = isVideo ? snap.endedAt : now

    if (
      totalWatchedMs <= 0 &&
      (!videoRanges || videoRanges.length === 0) &&
      (!pagesRead || pagesRead.length === 0)
    ) {
      return
    }

    try {
      await createMaterialProgress({
        materialId: material.id,
        goalId: currentSession.goalId,
        sessionId: currentSession.id,
        kind: material.kind,
        totalWatchedMs,
        videoRanges,
        pagesRead,
        pagesReadCounts,
        startedAt,
        endedAt,
      })
    } catch {
      // silent — the session may have already been stopped
    }
  }, [material])

  const handlePlayerReady = useCallback((player: MediaPlayer) => {
    playerRef.current = player
  }, [])

  const handleStateChange = useCallback(
    (state: MediaPlayerState) => {
      tracker.handleStateChange(state)
      onPlayerStateChange?.(state)
    },
    [tracker, onPlayerStateChange],
  )

  useEffect(() => {
    return () => {
      void persistProgress()
    }
  }, [persistProgress])

  if (material.kind === 'video-youtube') {
    const videoId = material.metadata?.youtubeVideoId
    if (!videoId) {
      return (
        <p className="rounded-2xl bg-surface p-5 text-sm text-[color:var(--color-text-muted)]">
          {t.materials.errors.metadataInvalidUrl}
        </p>
      )
    }
    return (
      <YouTubePlayer
        videoId={videoId}
        onReady={handlePlayerReady}
        onStateChange={handleStateChange}
        fullscreenLabel={t.timer.videoFullscreen}
      />
    )
  }

  if (material.kind === 'video-upload') {
    const blobId = material.fileBlobKey
    if (!blobId) {
      return (
        <p className="rounded-2xl bg-surface p-5 text-sm text-[color:var(--color-text-muted)]">
          {t.materials.errors.fileRequired}
        </p>
      )
    }
    return (
      <LocalVideoPlayer
        blobId={blobId}
        onReady={handlePlayerReady}
        onStateChange={handleStateChange}
        fullscreenLabel={t.timer.videoFullscreen}
      />
    )
  }

  if (material.kind === 'link' && material.url) {
    return (
      <a
        href={material.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal transition active:scale-[0.98]"
      >
        <span className="min-w-0 flex-1 truncate">{material.url}</span>
        <ExternalLink size={18} aria-hidden="true" />
      </a>
    )
  }

  if (material.kind === 'note' && material.notes) {
    return (
      <div className="whitespace-pre-wrap rounded-2xl bg-surface p-5 text-sm text-charcoal">
        {material.notes}
      </div>
    )
  }

  if (material.kind === 'pdf') {
    const blobId = material.fileBlobKey
    if (!blobId) {
      return (
        <p className="rounded-2xl bg-surface p-5 text-sm text-[color:var(--color-text-muted)]">
          {t.materials.errors.fileRequired}
        </p>
      )
    }
    return (
      <Suspense fallback={<Loading />}>
        <PdfViewer
          blobId={blobId}
          onPageRead={handlePageRead}
          fullscreenLabel={t.timer.videoFullscreen}
          zoomInLabel={t.timer.pdfZoomIn}
          zoomOutLabel={t.timer.pdfZoomOut}
          markReadLabel={t.timer.pdfMarkRead}
          timesReadLabel={(times) => tpl(t.timer.pdfTimesReadShort, { count: times })}
          pagesReadLabel={(read, total) =>
            tpl(t.timer.pdfPagesRead, { read, total })
          }
        />
      </Suspense>
    )
  }

  return null
}

export default TimerActiveMaterial

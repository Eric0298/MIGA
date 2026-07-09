import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Film,
  Link as LinkIcon,
  Pause,
  Play,
  PlaySquare,
  Plus,
  Square,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import type { MaterialKind, Session } from '@/lib/db/schema'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { useMaterialsByIds } from '@/features/materials/hooks/use-materials-by-ids'
import { useMaterialsByGoal } from '@/features/materials/hooks/use-materials-by-goal'
import {
  attachMaterialToSession,
  discardSession,
  pauseSession,
  resumeSession,
  stopSession,
} from '@/lib/db/sessions.repository'
import { useT } from '@/i18n/i18n-context'
import { useSyncTimerVideo } from '@/lib/settings/player-prefs'
import { formatDuration, getElapsedMs } from '../utils'
import { useElapsedTick } from '../hooks/use-elapsed-tick'
import TimerActiveMaterial, { type TimerActiveMaterialHandle } from './TimerActiveMaterial'
import NotesPanel from '@/features/notes/components/NotesPanel'
import { MEDIA_PLAYER_STATE, type MediaPlayerState } from '@/lib/api/media-player'

type TimerMaterialSessionProps = {
  session: Session
}

function TimerMaterialSession({ session }: TimerMaterialSessionProps) {
  const { t } = useT()
  const goals = useLiveGoals()
  const goal = goals?.find((g) => g.id === session.goalId) ?? null
  const now = useElapsedTick(session.status === 'running')
  const elapsed = getElapsedMs(session, now)
  const isPaused = session.status === 'paused'
  const [syncEnabled] = useSyncTimerVideo()
  const [showAdd, setShowAdd] = useState(false)
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(
    session.materialIds[0] ?? null,
  )
  const activeMaterialRef = useRef<TimerActiveMaterialHandle>(null)

  const attachedMaterials = useMaterialsByIds(session.materialIds)
  const goalMaterials = useMaterialsByGoal(session.goalId ?? undefined) ?? []
  const notYetAttached = useMemo(
    () => goalMaterials.filter((m) => !session.materialIds.includes(m.id)),
    [goalMaterials, session.materialIds],
  )
  const activeMaterial = attachedMaterials.find((m) => m.id === activeMaterialId) ?? null

  // Keep activeMaterialId in sync with session.materialIds changes.
  useEffect(() => {
    if (session.materialIds.length === 0) {
      if (activeMaterialId !== null) setActiveMaterialId(null)
      return
    }
    if (activeMaterialId === null || !session.materialIds.includes(activeMaterialId)) {
      setActiveMaterialId(session.materialIds[0])
    }
  }, [session.materialIds, activeMaterialId])

  const handlePlayerStateChange = useCallback(
    (state: MediaPlayerState) => {
      if (!syncEnabled) return
      if (state === MEDIA_PLAYER_STATE.PLAYING && session.status === 'paused') {
        resumeSession(session.id).catch(() => undefined)
      }
    },
    [syncEnabled, session.id, session.status],
  )

  const handlePause = async () => {
    try {
      await pauseSession(session.id)
    } catch {
      toast.error(t.timer.cannotPause)
    }
  }

  const handleResume = async () => {
    try {
      await resumeSession(session.id)
    } catch {
      toast.error(t.timer.cannotResume)
    }
  }

  const handleStop = async () => {
    try {
      // Flush the active material's progress into Dexie BEFORE we mark the
      // session completed, so the next session sees the up-to-date aggregate
      // instead of racing with an in-flight write.
      await activeMaterialRef.current?.flush().catch(() => undefined)
      await stopSession(session.id)
      toast.success(t.timer.sessionSaved)
    } catch {
      toast.error(t.timer.cannotStop)
    }
  }

  const handleDiscard = async () => {
    try {
      await discardSession(session.id)
      toast.success(t.timer.sessionDiscarded)
    } catch {
      toast.error(t.timer.cannotDiscard)
    }
  }

  const handleSelectMaterial = async (materialId: string) => {
    if (materialId === activeMaterialId) return
    await activeMaterialRef.current?.flush().catch(() => undefined)
    setActiveMaterialId(materialId)
  }

  const handleAttach = async (materialId: string) => {
    try {
      await activeMaterialRef.current?.flush().catch(() => undefined)
      await attachMaterialToSession(session.id, materialId)
      setActiveMaterialId(materialId)
      setShowAdd(false)
    } catch {
      toast.error(t.timer.cannotAttachMaterial)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[color:var(--color-text-muted)]">
              {goal ? goal.name : t.common.freeSession}
            </p>
            {activeMaterial && (
              <p className="truncate text-sm font-semibold text-charcoal">
                {activeMaterial.title}
              </p>
            )}
            {isPaused && (
              <p className="mt-0.5 text-xs font-medium text-apricot">{t.timer.paused}</p>
            )}
          </div>
          <p className="text-2xl font-bold text-charcoal tabular-nums" aria-live="polite">
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

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {attachedMaterials.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => void handleSelectMaterial(m.id)}
            aria-pressed={activeMaterialId === m.id}
            className={clsx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              activeMaterialId === m.id
                ? 'bg-apricot text-white'
                : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
            )}
          >
            {kindIcon(m.kind)}
            <span className="max-w-[10rem] truncate">{m.title}</span>
          </button>
        ))}
        {(session.goalId !== null && notYetAttached.length > 0) || attachedMaterials.length === 0 ? (
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            aria-expanded={showAdd}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-charcoal px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            <Plus size={14} aria-hidden="true" />
            {t.timer.addMaterial}
          </button>
        ) : null}
      </div>

      {showAdd && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-charcoal">
              {t.timer.attachMaterialTitle}
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              aria-label={t.common.cancel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] hover:bg-cream hover:text-charcoal"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {session.goalId === null ? (
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {t.timer.attachRequiresGoal}
            </p>
          ) : notYetAttached.length === 0 ? (
            <p className="text-xs text-[color:var(--color-text-muted)]">
              {t.timer.attachEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {notYetAttached.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => handleAttach(m.id)}
                    className="flex w-full items-center gap-3 rounded-xl bg-cream px-3 py-2 text-left ring-1 ring-[color:var(--color-border)] transition-colors hover:bg-peach"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-peach text-charcoal">
                      {kindIcon(m.kind)}
                    </span>
                    <span className="line-clamp-2 flex-1 text-xs font-medium text-charcoal">
                      {m.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeMaterial && (
        <TimerActiveMaterial
          ref={activeMaterialRef}
          key={activeMaterial.id}
          session={session}
          material={activeMaterial}
          onPlayerStateChange={handlePlayerStateChange}
        />
      )}

      {session.goalId && (
        <NotesPanel goalId={session.goalId} sourceSessionId={session.id} />
      )}
    </div>
  )
}

function kindIcon(kind: MaterialKind) {
  switch (kind) {
    case 'link':
      return <LinkIcon size={14} aria-hidden="true" />
    case 'note':
      return <StickyNote size={14} aria-hidden="true" />
    case 'video-youtube':
      return <PlaySquare size={14} aria-hidden="true" />
    case 'video-upload':
      return <Film size={14} aria-hidden="true" />
    case 'pdf':
      return <FileText size={14} aria-hidden="true" />
    default:
      return <StickyNote size={14} aria-hidden="true" />
  }
}

export default TimerMaterialSession

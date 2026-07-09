import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Mic, Square } from 'lucide-react'
import {
  deleteNoteBlob,
  putNoteBlob,
  setNoteBlobOwner,
} from '@/lib/db/note-blobs.repository'
import { createNote, deleteNote, updateNote } from '@/lib/db/notes.repository'
import { NOTE_LIMITS, type Note } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import AudioPlayer from './AudioPlayer'

type VoiceNoteEditorProps = {
  goalId: string
  sourceSessionId?: string | null
  existing?: Note | null
  onDone: () => void
  onCancel: () => void
}

type RecorderState = 'idle' | 'recording' | 'stopped'

const MAX_DURATION_MS = NOTE_LIMITS.voice.maxDurationSeconds * 1000
const MAX_MINUTES = Math.floor(NOTE_LIMITS.voice.maxDurationSeconds / 60)

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/mpeg',
  ]
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime
    } catch {
      // ignore browsers that throw on unknown mime
    }
  }
  return ''
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function VoiceNoteEditor({
  goalId,
  sourceSessionId = null,
  existing,
  onDone,
  onCancel,
}: VoiceNoteEditorProps) {
  const { t } = useT()
  const [title, setTitle] = useState(existing?.title ?? '')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Recorder state (only used when creating a new voice note).
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [cutoffReason, setCutoffReason] = useState<'user' | 'limit' | null>(null)
  const [supported] = useState(() => Boolean(pickSupportedMimeType()))

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const intervalRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const cleanupRecorder = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      try {
        recorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanupRecorder()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopRecording = useCallback(
    (reason: 'user' | 'limit') => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setCutoffReason(reason)
      const recorder = recorderRef.current
      if (recorder && recorder.state === 'recording') {
        try {
          recorder.stop()
        } catch {
          // ignore
        }
      }
    },
    [],
  )

  const startRecording = async () => {
    if (!supported) {
      toast.error(t.notes.voice.notSupported)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickSupportedMimeType()
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setState('stopped')
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
      }
      startedAtRef.current = Date.now()
      setElapsedMs(0)
      setCutoffReason(null)
      recorder.start(1000)
      setState('recording')
      intervalRef.current = window.setInterval(() => {
        const now = Date.now()
        const elapsed = now - startedAtRef.current
        setElapsedMs(elapsed)
        if (elapsed >= MAX_DURATION_MS) {
          stopRecording('limit')
        }
      }, 200)
    } catch {
      toast.error(t.notes.voice.micDenied)
    }
  }

  const discardRecording = () => {
    cleanupRecorder()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setState('idle')
    setElapsedMs(0)
    setCutoffReason(null)
  }

  const handleSaveNew = async () => {
    if (!audioBlob) return
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      toast.error(t.notes.errors.titleRequired)
      return
    }
    let blobId: string | null = null
    try {
      setSaving(true)
      const record = await putNoteBlob({ blob: audioBlob, mimeType: audioBlob.type })
      blobId = record.id
      const note = await createNote({
        goalId,
        kind: 'voice',
        title: trimmedTitle,
        fileBlobKey: blobId,
        metadata: {
          mimeType: audioBlob.type,
          fileSizeBytes: audioBlob.size,
          durationSeconds: Math.round(elapsedMs / 1000),
        },
        sourceSessionId: sourceSessionId ?? null,
      })
      await setNoteBlobOwner(blobId, note.id)
      toast.success(t.notes.saved)
      onDone()
    } catch {
      if (blobId) {
        try {
          await deleteNoteBlob(blobId)
        } catch {
          // best-effort cleanup
        }
      }
      toast.error(t.notes.cannotSave)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveExisting = async () => {
    if (!existing) return
    const trimmedTitle = title.trim()
    if (trimmedTitle.length === 0) {
      toast.error(t.notes.errors.titleRequired)
      return
    }
    try {
      setSaving(true)
      await updateNote(existing.id, { title: trimmedTitle })
      toast.success(t.notes.saved)
      onDone()
    } catch {
      toast.error(t.notes.cannotSave)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existing) return
    try {
      await deleteNote(existing.id)
      toast.success(t.notes.deleted)
      onDone()
    } catch {
      toast.error(t.notes.cannotDelete)
    }
  }

  // --------- View existing voice note ---------
  if (existing) {
    return (
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t.notes.titlePlaceholder}
          maxLength={80}
          className="rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
        />
        {existing.fileBlobKey && <AudioPlayer blobId={existing.fileBlobKey} />}
        <p className="text-xs text-[color:var(--color-text-muted)]">
          {t.notes.voice.notEditable}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveExisting}
            disabled={saving}
            className="flex-1 rounded-2xl bg-apricot px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {t.notes.save}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            {t.common.cancel}
          </button>
        </div>
        {!showDeleteConfirm && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="self-start text-xs font-medium text-apricot underline decoration-dotted underline-offset-2"
          >
            {t.notes.delete}
          </button>
        )}
        {showDeleteConfirm && (
          <div
            role="alertdialog"
            className="flex flex-col gap-2 rounded-xl bg-apricot p-3 text-white"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} aria-hidden="true" />
              <p className="text-sm font-semibold">{t.notes.confirmDeleteTitle}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-apricot transition active:scale-[0.98]"
              >
                {t.notes.confirmDeleteYes}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/40 transition active:scale-[0.98]"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --------- Record new voice note ---------
  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t.notes.titlePlaceholder}
        maxLength={80}
        className="rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
      />

      {!supported && (
        <p className="rounded-xl bg-apricot/10 px-3 py-2 text-xs font-medium text-apricot">
          {t.notes.voice.notSupported}
        </p>
      )}

      {state === 'idle' && supported && (
        <>
          <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
            {tpl(t.notes.voice.estimatedMax, { minutes: MAX_MINUTES })}
          </p>
          <button
            type="button"
            onClick={startRecording}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-apricot px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <Mic size={16} aria-hidden="true" />
            {t.notes.voice.startRecording}
          </button>
        </>
      )}

      {state === 'recording' && (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-cream px-4 py-4 ring-1 ring-[color:var(--color-border)]">
          <div className="flex items-center gap-2 text-apricot">
            <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-apricot" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {t.notes.voice.recording}
            </span>
          </div>
          <p className="text-3xl font-bold tabular-nums text-charcoal">
            {formatMs(elapsedMs)} / {formatMs(MAX_DURATION_MS)}
          </p>
          <button
            type="button"
            onClick={() => stopRecording('user')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-charcoal px-4 py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <Square size={16} aria-hidden="true" />
            {t.notes.voice.stopRecording}
          </button>
        </div>
      )}

      {state === 'stopped' && audioUrl && (
        <div className="flex flex-col gap-3 rounded-xl bg-cream px-4 py-3 ring-1 ring-[color:var(--color-border)]">
          {cutoffReason === 'limit' && (
            <p className="rounded-lg bg-apricot/10 px-2 py-1.5 text-xs font-medium text-apricot">
              {tpl(t.notes.voice.autoCutoffMessage, { minutes: MAX_MINUTES })}
            </p>
          )}
          <p className="text-xs font-medium text-[color:var(--color-text-muted)]">
            {tpl(t.notes.voice.recordedDuration, { time: formatMs(elapsedMs) })}
          </p>
          <audio src={audioUrl} controls preload="metadata" className="w-full" />
        </div>
      )}

      {state === 'stopped' && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveNew}
            disabled={saving || !audioBlob}
            className="flex-1 rounded-2xl bg-apricot px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {t.notes.save}
          </button>
          <button
            type="button"
            onClick={discardRecording}
            className="flex-1 rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            {t.notes.voice.discardAndRetry}
          </button>
        </div>
      )}

      {state !== 'recording' && (
        <button
          type="button"
          onClick={() => {
            cleanupRecorder()
            if (audioUrl) URL.revokeObjectURL(audioUrl)
            onCancel()
          }}
          className="self-start text-xs font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-charcoal"
        >
          {t.common.cancel}
        </button>
      )}
    </div>
  )
}

export default VoiceNoteEditor

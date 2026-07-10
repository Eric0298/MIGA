import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  ImagePlus,
  Mic,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  createQuestion,
  deleteQuestion,
  getQuestion,
  updateQuestion,
} from '@/lib/db/questions.repository'
import {
  deleteQuestionBlob,
  getQuestionBlob,
  putQuestionBlob,
  setQuestionBlobOwner,
} from '@/lib/db/question-blobs.repository'
import {
  QUESTION_LIMITS,
  type Question,
  type QuestionAnswerInput,
} from '@/lib/db/schema'
import { formatBytes } from '@/lib/format-bytes'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import type { Messages } from '@/i18n/messages/es'

type QuestionEditorProps = {
  goalId: string
  existingQuestionId?: string
  onDone: () => void
  onCancel: () => void
}

type MediaSlot = {
  /** Blob id stored in Dexie for the CURRENT attachment (if any). */
  currentKey: string | null
  /** Object URL for the current attachment (preview of the loaded blob). */
  currentUrl: string | null
  /** Newly picked blob waiting to be persisted on save. */
  pendingBlob: Blob | null
  /** Object URL for the pending blob preview. */
  pendingUrl: string | null
  /** MIME type of the pending blob. */
  pendingMimeType: string | null
  /** User asked to remove the current attachment without replacing it. */
  removed: boolean
}

const EMPTY_SLOT: MediaSlot = {
  currentKey: null,
  currentUrl: null,
  pendingBlob: null,
  pendingUrl: null,
  pendingMimeType: null,
  removed: false,
}

const AUDIO_MAX_DURATION_MS = 15 * 60 * 1000 // 15 min, same practical limit as voice notes

function pickAudioMimeType(): string {
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
      // ignore
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

function validateImageFile(
  file: File,
  errors: Messages['materials']['errors'],
): string | null {
  if (
    !QUESTION_LIMITS.image.mimeTypes.includes(
      file.type as (typeof QUESTION_LIMITS.image.mimeTypes)[number],
    )
  ) {
    return errors.fileInvalidType
  }
  if (file.size > QUESTION_LIMITS.image.maxBytes) return errors.fileTooLarge
  return null
}

function QuestionEditor({
  goalId,
  existingQuestionId,
  onDone,
  onCancel,
}: QuestionEditorProps) {
  const { t } = useT()
  const [prompt, setPrompt] = useState('')
  const [answers, setAnswers] = useState<QuestionAnswerInput[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ])
  const [image, setImage] = useState<MediaSlot>(EMPTY_SLOT)
  const [audio, setAudio] = useState<MediaSlot>(EMPTY_SLOT)
  const [loaded, setLoaded] = useState<Question | null>(null)
  const [loading, setLoading] = useState(Boolean(existingQuestionId))
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Load existing question and its attached blobs.
  useEffect(() => {
    if (!existingQuestionId) return
    let cancelled = false
    let imageObjectUrl: string | null = null
    let audioObjectUrl: string | null = null
    ;(async () => {
      const question = await getQuestion(existingQuestionId).catch(() => null)
      if (cancelled || !question) {
        if (!cancelled) setLoading(false)
        return
      }
      setLoaded(question)
      setPrompt(question.prompt)
      setAnswers(
        question.answers.map((a) => ({
          id: a.id,
          text: a.text,
          isCorrect: a.isCorrect,
        })),
      )
      if (question.imageBlobKey) {
        const record = await getQuestionBlob(question.imageBlobKey).catch(() => null)
        if (!cancelled && record) {
          imageObjectUrl = URL.createObjectURL(record.blob)
          setImage({
            ...EMPTY_SLOT,
            currentKey: question.imageBlobKey,
            currentUrl: imageObjectUrl,
          })
        }
      }
      if (question.audioBlobKey) {
        const record = await getQuestionBlob(question.audioBlobKey).catch(() => null)
        if (!cancelled && record) {
          audioObjectUrl = URL.createObjectURL(record.blob)
          setAudio({
            ...EMPTY_SLOT,
            currentKey: question.audioBlobKey,
            currentUrl: audioObjectUrl,
          })
        }
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl)
      if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl)
    }
  }, [existingQuestionId])

  // Revoke the pending preview URLs when they change or on unmount.
  useEffect(() => {
    return () => {
      if (image.pendingUrl) URL.revokeObjectURL(image.pendingUrl)
      if (audio.pendingUrl) URL.revokeObjectURL(audio.pendingUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------- Image handlers ----------------
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    if (!picked) return
    const error = validateImageFile(picked, t.materials.errors)
    if (error) {
      setImageError(error)
      e.target.value = ''
      return
    }
    setImageError(null)
    setImage((prev) => {
      if (prev.pendingUrl) URL.revokeObjectURL(prev.pendingUrl)
      return {
        ...prev,
        pendingBlob: picked,
        pendingMimeType: picked.type,
        pendingUrl: URL.createObjectURL(picked),
        removed: false,
      }
    })
  }
  const handleImageRemove = () => {
    setImage((prev) => {
      if (prev.pendingUrl) URL.revokeObjectURL(prev.pendingUrl)
      return {
        ...prev,
        pendingBlob: null,
        pendingMimeType: null,
        pendingUrl: null,
        removed: prev.currentKey !== null,
      }
    })
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  // ---------------- Audio recorder ----------------
  const [recording, setRecording] = useState(false)
  const [recordingMs, setRecordingMs] = useState(0)
  const [recorderSupported] = useState(() => Boolean(pickAudioMimeType()))
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
    return () => cleanupRecorder()
  }, [cleanupRecorder])

  const stopRecording = useCallback(() => {
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
    setRecording(false)
  }, [])

  const startRecording = async () => {
    if (!recorderSupported) {
      toast.error(t.questions.audioNotSupported)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickAudioMimeType()
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
        setAudio((prev) => {
          if (prev.pendingUrl) URL.revokeObjectURL(prev.pendingUrl)
          return {
            ...prev,
            pendingBlob: blob,
            pendingMimeType: type,
            pendingUrl: URL.createObjectURL(blob),
            removed: false,
          }
        })
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
      }
      startedAtRef.current = Date.now()
      setRecordingMs(0)
      recorder.start(1000)
      setRecording(true)
      intervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current
        setRecordingMs(elapsed)
        if (elapsed >= AUDIO_MAX_DURATION_MS) {
          stopRecording()
        }
      }, 200)
    } catch {
      toast.error(t.questions.micDenied)
    }
  }

  const handleAudioRemove = () => {
    setAudio((prev) => {
      if (prev.pendingUrl) URL.revokeObjectURL(prev.pendingUrl)
      return {
        ...prev,
        pendingBlob: null,
        pendingMimeType: null,
        pendingUrl: null,
        removed: prev.currentKey !== null,
      }
    })
  }

  // ---------------- Answers handlers ----------------
  const addAnswer = () => {
    if (answers.length >= QUESTION_LIMITS.answer.maxCount) return
    setAnswers((prev) => [...prev, { text: '', isCorrect: false }])
  }
  const removeAnswer = (index: number) => {
    if (answers.length <= QUESTION_LIMITS.answer.minCount) return
    setAnswers((prev) => prev.filter((_, i) => i !== index))
  }
  const setAnswerText = (index: number, text: string) => {
    setAnswers((prev) =>
      prev.map((a, i) => (i === index ? { ...a, text } : a)),
    )
  }
  const toggleAnswerCorrect = (index: number) => {
    setAnswers((prev) =>
      prev.map((a, i) => (i === index ? { ...a, isCorrect: !a.isCorrect } : a)),
    )
  }

  // ---------------- Save ----------------
  const handleSave = async () => {
    const trimmedPrompt = prompt.trim()
    if (trimmedPrompt.length === 0) {
      toast.error(t.questions.errors.promptRequired)
      return
    }
    if (trimmedPrompt.length > QUESTION_LIMITS.prompt.maxChars) {
      toast.error(t.questions.errors.promptMax)
      return
    }
    const cleanAnswers = answers
      .map((a) => ({ ...a, text: a.text.trim() }))
      .filter((a) => a.text.length > 0)
    if (cleanAnswers.length < QUESTION_LIMITS.answer.minCount) {
      toast.error(t.questions.errors.minAnswers)
      return
    }
    if (cleanAnswers.length > QUESTION_LIMITS.answer.maxCount) {
      toast.error(t.questions.errors.maxAnswers)
      return
    }
    if (!cleanAnswers.some((a) => a.isCorrect)) {
      toast.error(t.questions.errors.needCorrect)
      return
    }

    let newImageKey: string | undefined
    let newAudioKey: string | undefined
    const createdBlobKeys: string[] = []
    try {
      setSaving(true)
      // Upload new media if any.
      if (image.pendingBlob) {
        const record = await putQuestionBlob({
          blob: image.pendingBlob,
          kind: 'image',
          mimeType: image.pendingMimeType ?? image.pendingBlob.type,
        })
        newImageKey = record.id
        createdBlobKeys.push(record.id)
      }
      if (audio.pendingBlob) {
        const record = await putQuestionBlob({
          blob: audio.pendingBlob,
          kind: 'audio',
          mimeType: audio.pendingMimeType ?? audio.pendingBlob.type,
        })
        newAudioKey = record.id
        createdBlobKeys.push(record.id)
      }

      // Effective keys after this save:
      const effectiveImageKey = newImageKey ?? (image.removed ? undefined : image.currentKey ?? undefined)
      const effectiveAudioKey = newAudioKey ?? (audio.removed ? undefined : audio.currentKey ?? undefined)

      if (loaded) {
        await updateQuestion(loaded.id, {
          prompt: trimmedPrompt,
          answers: cleanAnswers,
          imageBlobKey: effectiveImageKey ?? null,
          audioBlobKey: effectiveAudioKey ?? null,
        })
        // Attach new blobs to the existing question and drop old ones.
        for (const key of createdBlobKeys) {
          await setQuestionBlobOwner(key, loaded.id)
        }
        if (newImageKey || image.removed) {
          if (image.currentKey) {
            try {
              await deleteQuestionBlob(image.currentKey)
            } catch {
              // orphan blob, but the question no longer references it
            }
          }
        }
        if (newAudioKey || audio.removed) {
          if (audio.currentKey) {
            try {
              await deleteQuestionBlob(audio.currentKey)
            } catch {
              // best-effort
            }
          }
        }
      } else {
        const created = await createQuestion({
          goalId,
          prompt: trimmedPrompt,
          answers: cleanAnswers,
          imageBlobKey: effectiveImageKey,
          audioBlobKey: effectiveAudioKey,
        })
        for (const key of createdBlobKeys) {
          await setQuestionBlobOwner(key, created.id)
        }
      }
      toast.success(t.questions.saved)
      onDone()
    } catch {
      // Best-effort rollback of blobs we uploaded during this attempt.
      for (const key of createdBlobKeys) {
        try {
          await deleteQuestionBlob(key)
        } catch {
          // ignore
        }
      }
      toast.error(t.questions.cannotSave)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!loaded) return
    try {
      await deleteQuestion(loaded.id)
      toast.success(t.questions.deleted)
      onDone()
    } catch {
      toast.error(t.questions.cannotDelete)
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
    )
  }

  // Derived UI state
  const imagePreview = image.pendingUrl ?? (image.removed ? null : image.currentUrl)
  const audioPreview = audio.pendingUrl ?? (audio.removed ? null : audio.currentUrl)

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={t.questions.promptPlaceholder}
        rows={4}
        maxLength={QUESTION_LIMITS.prompt.maxChars}
        className="resize-none rounded-xl bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
      />

      {/* ---------------- Image attachment ---------------- */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-charcoal">{t.questions.imageLabel}</p>
        {imagePreview ? (
          <div className="flex items-start gap-2">
            <img
              src={imagePreview}
              alt=""
              className="max-h-40 w-full max-w-xs rounded-lg object-contain ring-1 ring-black/5"
            />
            <button
              type="button"
              onClick={handleImageRemove}
              aria-label={t.questions.removeImage}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <label
              htmlFor={`q-image-${existingQuestionId ?? 'new'}`}
              className="inline-flex cursor-pointer items-center gap-2 self-start rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
            >
              <ImagePlus size={14} aria-hidden="true" />
              {t.questions.addImage}
            </label>
            <p className="text-[11px] text-[color:var(--color-text-muted)]">
              {tpl(t.questions.imageHint, {
                max: formatBytes(QUESTION_LIMITS.image.maxBytes),
              })}
            </p>
          </>
        )}
        <input
          ref={imageInputRef}
          id={`q-image-${existingQuestionId ?? 'new'}`}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleImageChange}
        />
        {imageError && <p className="text-xs text-apricot">{imageError}</p>}
      </div>

      {/* ---------------- Audio attachment ---------------- */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold text-charcoal">{t.questions.audioLabel}</p>
        {audioPreview ? (
          <div className="flex items-start gap-2">
            <audio
              src={audioPreview}
              controls
              preload="metadata"
              className="w-full max-w-xs"
            />
            <button
              type="button"
              onClick={handleAudioRemove}
              aria-label={t.questions.removeAudio}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : recording ? (
          <div className="flex items-center gap-3 rounded-xl bg-cream px-3 py-2 ring-1 ring-[color:var(--color-border)]">
            <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-apricot" />
            <span className="font-bold text-charcoal tabular-nums">
              {formatMs(recordingMs)} / {formatMs(AUDIO_MAX_DURATION_MS)}
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98]"
            >
              <Square size={12} aria-hidden="true" />
              {t.questions.stopRecording}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={startRecording}
              disabled={!recorderSupported}
              className="inline-flex items-center gap-2 self-start rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98] disabled:opacity-60"
            >
              <Mic size={14} aria-hidden="true" />
              {t.questions.recordAudio}
            </button>
            {!recorderSupported && (
              <p className="text-[11px] text-apricot">{t.questions.audioNotSupported}</p>
            )}
          </>
        )}
      </div>

      {/* ---------------- Answers ---------------- */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-charcoal">{t.questions.answersLabel}</p>
          <button
            type="button"
            onClick={addAnswer}
            disabled={answers.length >= QUESTION_LIMITS.answer.maxCount}
            className="inline-flex items-center gap-1 rounded-lg bg-cream px-2 py-1 text-[11px] font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98] disabled:opacity-40"
          >
            <Plus size={12} aria-hidden="true" />
            {t.questions.addAnswer}
          </button>
        </div>
        <p className="text-[11px] text-[color:var(--color-text-muted)]">
          {t.questions.answersHint}
        </p>
        <ul className="flex flex-col gap-1.5">
          {answers.map((answer, index) => (
            <li key={answer.id ?? `new-${index}`} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAnswerCorrect(index)}
                aria-pressed={answer.isCorrect}
                aria-label={
                  answer.isCorrect
                    ? t.questions.markIncorrect
                    : t.questions.markCorrect
                }
                className={clsx(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition active:scale-[0.98]',
                  answer.isCorrect
                    ? 'bg-pistachio text-charcoal'
                    : 'bg-cream text-[color:var(--color-text-muted)] ring-1 ring-[color:var(--color-border)]',
                )}
              >
                <Check size={14} aria-hidden="true" />
              </button>
              <input
                type="text"
                value={answer.text}
                onChange={(e) => setAnswerText(index, e.target.value)}
                placeholder={t.questions.answerPlaceholder}
                maxLength={QUESTION_LIMITS.answer.maxChars}
                className="flex-1 rounded-lg bg-cream px-3 py-2 text-sm text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeAnswer(index)}
                disabled={answers.length <= QUESTION_LIMITS.answer.minCount}
                aria-label={t.questions.removeAnswer}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal disabled:opacity-30"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* ---------------- Actions ---------------- */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-2xl bg-apricot px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          {t.questions.save}
        </button>
        <button
          type="button"
          onClick={() => {
            cleanupRecorder()
            onCancel()
          }}
          className="flex-1 rounded-2xl bg-cream px-4 py-2.5 text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
        >
          {t.common.cancel}
        </button>
      </div>

      {loaded && !showDeleteConfirm && (
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="self-start text-xs font-medium text-apricot underline decoration-dotted underline-offset-2"
        >
          {t.questions.delete}
        </button>
      )}
      {showDeleteConfirm && (
        <div
          role="alertdialog"
          className="flex flex-col gap-2 rounded-xl bg-apricot p-3 text-white"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} aria-hidden="true" />
            <p className="text-sm font-semibold">{t.questions.confirmDeleteTitle}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-apricot transition active:scale-[0.98]"
            >
              {t.questions.confirmDeleteYes}
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

export default QuestionEditor

import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Download, Languages, PlaySquare, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { clsx } from 'clsx'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'
import { buildExportPayload, importAllData, parseImportPayload } from '@/lib/db/import-export'
import { getActiveSession } from '@/lib/db/sessions.repository'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import type { Language } from '@/i18n/types'
import { useSyncTimerVideo } from '@/lib/settings/player-prefs'
import { AccountPanel } from '@/features/auth/AccountPanel'
import { useAuth } from '@/features/auth/AuthProvider'
import { assertImportFileSize } from '@/lib/db/import-file'

function SettingsPage() {
  const { t, lang, setLang } = useT()
  const auth = useAuth()
  const [syncTimerVideo, setSyncTimerVideo] = useSyncTimerVideo()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [busy, setBusy] = useState<'export' | 'import' | 'clear' | null>(null)
  const totals = useLiveQuery(
    async () => ({
      goals: await db.goals.count(),
      sessions: await db.sessions.count(),
      materials: await db.materials.count(),
      notes: await db.notes.count(),
      questions: await db.questions.count(),
      examAttempts: await db.examAttempts.count(),
    }),
    [],
  )

  const handleExport = async () => {
    try {
      setBusy('export')
      const payload = await buildExportPayload()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const stamp = format(new Date(payload.exportedAt), 'yyyy-MM-dd-HHmm')
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `miga-backup-${stamp}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast.success(t.settings.exportSuccess)
    } catch {
      toast.error(t.settings.exportError)
    } finally {
      setBusy(null)
    }
  }

  const handleImportClick = async () => {
    const active = await getActiveSession()
    if (active) {
      toast.error(t.settings.importBlocked)
      return
    }
    fileRef.current?.click()
  }

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      setBusy('import')
      assertImportFileSize(file.size)
      const text = await file.text()
      const parsed = parseImportPayload(JSON.parse(text))
      const result = await importAllData(parsed)
      const extras =
        result.normalizedActiveSessions > 0
          ? tpl(t.settings.importActiveCleared, { count: result.normalizedActiveSessions })
          : ''
      toast.success(t.settings.importSuccess, {
        description: tpl(t.settings.importSummary, {
          goals: result.goalsCount,
          sessions: result.sessionsCount,
          materials: result.materialsCount,
          notes: result.notesCount,
          questions: result.questionsCount,
          exams: result.examAttemptsCount,
          extras,
        }),
      })
    } catch (cause) {
      toast.error(
        cause instanceof Error && cause.message.includes('5 MiB')
          ? t.settings.importTooLarge
          : t.settings.importInvalid,
      )
    } finally {
      setBusy(null)
    }
  }

  const handleClearRequest = async () => {
    const active = await getActiveSession()
    if (active) {
      toast.error(t.settings.clearBlocked)
      return
    }
    setShowClearConfirm(true)
  }

  const handleClearConfirm = async () => {
    try {
      setBusy('clear')
      const active = await getActiveSession()
      if (active) {
        toast.error(t.settings.clearBlocked)
        return
      }
      await auth.deleteLocalData()
      toast.success(t.settings.clearSuccess)
    } catch {
      toast.error(t.settings.clearError)
    } finally {
      setBusy(null)
      setShowClearConfirm(false)
    }
  }

  const languageOptions: { code: Language; label: string }[] = [
    { code: 'es', label: t.settings.languageSpanish },
    { code: 'en', label: t.settings.languageEnglish },
    { code: 'va', label: t.settings.languageValencian },
  ]

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{t.settings.subtitle}</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-charcoal">{t.settings.languageSection}</h2>
        <p className="text-xs text-[color:var(--color-text-muted)]">{t.settings.languageHint}</p>
        <div
          role="radiogroup"
          aria-label={t.settings.languageSection}
          className="grid grid-cols-3 gap-2"
        >
          {languageOptions.map((option) => (
            <button
              key={option.code}
              type="button"
              role="radio"
              aria-checked={lang === option.code}
              onClick={() => setLang(option.code)}
              className={clsx(
                'inline-flex items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors',
                lang === option.code
                  ? 'bg-apricot text-white'
                  : 'bg-surface text-charcoal ring-1 ring-[color:var(--color-border)]',
              )}
            >
              <Languages size={14} aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <AccountPanel />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-charcoal">{t.settings.playerSection}</h2>
        <p className="text-xs text-[color:var(--color-text-muted)]">{t.settings.playerHint}</p>
        <button
          type="button"
          role="switch"
          aria-checked={syncTimerVideo}
          onClick={() => setSyncTimerVideo(!syncTimerVideo)}
          className="inline-flex items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 text-left text-base font-semibold text-charcoal transition active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-peach text-charcoal">
              <PlaySquare size={18} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span>{t.settings.syncTimerVideo}</span>
              <span className="text-xs font-normal text-[color:var(--color-text-muted)]">
                {t.settings.syncTimerVideoHint}
              </span>
            </span>
          </span>
          <span
            className={clsx(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
              syncTimerVideo ? 'bg-apricot' : 'bg-[color:var(--color-border)]',
            )}
            aria-hidden="true"
          >
            <span
              className={clsx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                syncTimerVideo ? 'translate-x-[22px]' : 'translate-x-0.5',
              )}
            />
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-charcoal">{t.settings.dataSection}</h2>
        <p className="text-xs text-[color:var(--color-text-muted)]">{t.settings.dataHint}</p>

        <button
          type="button"
          onClick={handleExport}
          disabled={busy !== null}
          className="inline-flex items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal transition active:scale-[0.98] disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-peach text-charcoal">
              <Download size={18} aria-hidden="true" />
            </span>
            {t.settings.export}
          </span>
          <span className="text-xs font-normal text-[color:var(--color-text-muted)]">
            {t.settings.exportBadge}
          </span>
        </button>

        <button
          type="button"
          onClick={handleImportClick}
          disabled={busy !== null}
          className="inline-flex items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal transition active:scale-[0.98] disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-peach text-charcoal">
              <Upload size={18} aria-hidden="true" />
            </span>
            {t.settings.import}
          </span>
          <span className="text-xs font-normal text-[color:var(--color-text-muted)]">
            {t.settings.importBadge}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={handleFileSelected}
        />

        <button
          type="button"
          onClick={handleClearRequest}
          disabled={busy !== null || showClearConfirm}
          className="inline-flex items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal ring-1 ring-apricot transition active:scale-[0.98] disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-peach text-apricot">
              <Trash2 size={18} aria-hidden="true" />
            </span>
            {t.settings.clear}
          </span>
          <span className="text-xs font-normal text-[color:var(--color-text-muted)]">
            {t.settings.clearBadge}
          </span>
        </button>
      </section>

      {showClearConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="clear-confirm-title"
          className="flex flex-col gap-4 rounded-2xl bg-apricot p-5 text-white"
        >
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <AlertTriangle size={20} aria-hidden="true" />
            </span>
            <div>
              <p id="clear-confirm-title" className="text-base font-semibold">
                {t.settings.clearConfirmTitle}
              </p>
              <p className="mt-1 text-sm opacity-90">
                {tpl(t.settings.clearConfirmDescription, {
                  goals: totals?.goals ?? 0,
                  goalWord:
                    (totals?.goals ?? 0) === 1 ? t.settings.goalWordOne : t.settings.goalWordOther,
                  sessions: totals?.sessions ?? 0,
                  sessionWord:
                    (totals?.sessions ?? 0) === 1
                      ? t.settings.sessionWordOne
                      : t.settings.sessionWordOther,
                  materials: totals?.materials ?? 0,
                  notes: totals?.notes ?? 0,
                  questions: totals?.questions ?? 0,
                  exams: totals?.examAttempts ?? 0,
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleClearConfirm}
              disabled={busy === 'clear'}
              className="flex-1 rounded-2xl bg-white px-5 py-3 text-base font-semibold text-apricot transition active:scale-[0.98] disabled:opacity-70"
            >
              {t.settings.clearConfirmYes}
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              disabled={busy === 'clear'}
              className="flex-1 rounded-2xl bg-white/15 px-5 py-3 text-base font-semibold text-white ring-1 ring-white/40 transition active:scale-[0.98] disabled:opacity-70"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-charcoal">{t.settings.infoSection}</h2>
        <nav aria-label={t.settings.additionalLinks} className="flex flex-col gap-3">
          <Link
            to="/arquitectura"
            className="rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal"
          >
            {t.settings.architecture}
          </Link>
          <Link
            to="/privacidad"
            className="rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal"
          >
            {t.settings.privacy}
          </Link>
          <Link
            to="/"
            className="rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal"
          >
            {t.settings.landing}
          </Link>
        </nav>
      </section>
    </div>
  )
}

export default SettingsPage

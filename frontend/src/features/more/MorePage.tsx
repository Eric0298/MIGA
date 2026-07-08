import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Download, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'
import {
  buildExportPayload,
  clearAllData,
  importAllData,
  parseImportPayload,
} from '@/lib/db/import-export'
import { getActiveSession } from '@/lib/db/sessions.repository'

function MorePage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [busy, setBusy] = useState<'export' | 'import' | 'clear' | null>(null)
  const totals = useLiveQuery(
    async () => ({
      goals: await db.goals.count(),
      sessions: await db.sessions.count(),
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
      toast.success('Copia descargada')
    } catch {
      toast.error('No se pudo exportar')
    } finally {
      setBusy(null)
    }
  }

  const handleImportClick = async () => {
    const active = await getActiveSession()
    if (active) {
      toast.error('Detén la sesión activa antes de importar')
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
      const text = await file.text()
      const parsed = parseImportPayload(JSON.parse(text))
      const result = await importAllData(parsed)
      const extras =
        result.normalizedActiveSessions > 0
          ? ` (${result.normalizedActiveSessions} sesión activa cerrada)`
          : ''
      toast.success(
        `Importadas ${result.goalsCount} metas y ${result.sessionsCount} sesiones${extras}`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Archivo inválido'
      toast.error(message)
    } finally {
      setBusy(null)
    }
  }

  const handleClearRequest = async () => {
    const active = await getActiveSession()
    if (active) {
      toast.error('Detén la sesión activa antes de borrar')
      return
    }
    setShowClearConfirm(true)
  }

  const handleClearConfirm = async () => {
    try {
      setBusy('clear')
      const active = await getActiveSession()
      if (active) {
        toast.error('Detén la sesión activa antes de borrar')
        return
      }
      await clearAllData()
      toast.success('Todos los datos locales han sido borrados')
    } catch {
      toast.error('No se pudo borrar')
    } finally {
      setBusy(null)
      setShowClearConfirm(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Más</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          Ajustes de datos e información del proyecto.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-charcoal">Datos</h2>
        <p className="text-xs text-[color:var(--color-text-muted)]">
          Todo se guarda en tu dispositivo. Usa exportar como copia de seguridad e importar para
          restaurar en otro dispositivo.
        </p>

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
            Exportar copia
          </span>
          <span className="text-xs font-normal text-[color:var(--color-text-muted)]">.json</span>
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
            Importar copia
          </span>
          <span className="text-xs font-normal text-[color:var(--color-text-muted)]">
            Sobrescribe por id
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
            Borrar todos los datos
          </span>
          <span className="text-xs font-normal text-[color:var(--color-text-muted)]">Local</span>
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
                ¿Borrar todos los datos locales?
              </p>
              <p className="mt-1 text-sm opacity-90">
                Se eliminarán {totals?.goals ?? 0}{' '}
                {totals?.goals === 1 ? 'meta' : 'metas'} y {totals?.sessions ?? 0}{' '}
                {totals?.sessions === 1 ? 'sesión' : 'sesiones'} de este dispositivo.
                Esta acción no se puede deshacer.
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
              Sí, borrar todo
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              disabled={busy === 'clear'}
              className="flex-1 rounded-2xl bg-white/15 px-5 py-3 text-base font-semibold text-white ring-1 ring-white/40 transition active:scale-[0.98] disabled:opacity-70"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-charcoal">Información</h2>
        <nav aria-label="Enlaces adicionales" className="flex flex-col gap-3">
          <Link
            to="/arquitectura"
            className="rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal"
          >
            Ver arquitectura
          </Link>
          <Link
            to="/"
            className="rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal"
          >
            Volver a la landing
          </Link>
        </nav>
      </section>
    </div>
  )
}

export default MorePage

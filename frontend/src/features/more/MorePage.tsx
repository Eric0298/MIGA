import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { Download, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  buildExportPayload,
  clearAllData,
  importAllData,
  parseImportPayload,
} from '@/lib/db/import-export'
import { getActiveSession } from '@/lib/db/sessions.repository'

function MorePage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [busy, setBusy] = useState<'export' | 'import' | 'clear' | null>(null)

  useEffect(() => {
    if (!confirmingClear) return
    const t = setTimeout(() => setConfirmingClear(false), 4000)
    return () => clearTimeout(t)
  }, [confirmingClear])

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

  const handleClearClick = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
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
      setConfirmingClear(false)
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
          onClick={handleClearClick}
          disabled={busy !== null}
          className="inline-flex items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal ring-1 ring-apricot transition active:scale-[0.98] disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-peach text-apricot">
              <Trash2 size={18} aria-hidden="true" />
            </span>
            {confirmingClear ? '¿Confirmar? Toca de nuevo' : 'Borrar todos los datos'}
          </span>
          <span className="text-xs font-normal text-[color:var(--color-text-muted)]">Local</span>
        </button>
      </section>

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

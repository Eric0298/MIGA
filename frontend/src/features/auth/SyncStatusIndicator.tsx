import { AlertTriangle, CloudOff, Loader2, WifiOff } from 'lucide-react'
import { useT } from '@/i18n/i18n-context'
import { useWorkspaceSync } from '@/lib/sync/WorkspaceSyncProvider'
import { authCopyByLanguage } from './auth-copy'
import { useAuth } from './AuthProvider'

/**
 * Registered-account sync feedback. Renders nothing when everything is up to
 * date so the "Guardado" chrome does not sit on every screen. Only the states
 * a user can act on (or should notice) are surfaced.
 */
export function SyncStatusIndicator() {
  const auth = useAuth()
  const sync = useWorkspaceSync()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]

  if (!auth.session.authenticated || auth.session.accountType !== 'registered') return null

  switch (sync.status) {
    case 'syncing':
      return (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 border-b border-[color:var(--color-border)] bg-white px-5 py-1.5 text-xs text-[color:var(--color-text-muted)]"
        >
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          <span>{copy.sync2.saving}</span>
        </div>
      )
    case 'pending':
      return (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 border-b border-[color:var(--color-border)] bg-white px-5 py-1.5 text-xs text-[color:var(--color-text-muted)]"
        >
          <CloudOff size={14} aria-hidden="true" />
          <span>{copy.sync2.pending}</span>
        </div>
      )
    case 'error':
      return (
        <div
          role="alert"
          className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-900"
        >
          <WifiOff size={14} aria-hidden="true" />
          <span>{copy.sync2.offline}</span>
        </div>
      )
    case 'conflict':
      return (
        <div
          role="alert"
          className="flex items-center justify-center gap-2 border-b border-red-200 bg-red-50 px-5 py-2 text-xs font-semibold text-red-900"
        >
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{copy.sync2.conflict}</span>
        </div>
      )
    case 'synced':
    default:
      return null
  }
}

import { useState } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import { useWorkspaceSync } from '@/lib/sync/WorkspaceSyncProvider'
import { authCopyByLanguage } from './auth-copy'
import { useAuth } from './AuthProvider'

export function DemoBanner() {
  const auth = useAuth()
  const sync = useWorkspaceSync()
  const { lang, locale } = useT()
  const copy = authCopyByLanguage[lang]
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState(false)
  const isDemo = auth.session.authenticated && auth.session.accountType === 'demo'
  const expiresAt = auth.session.authenticated ? auth.session.expiresAtUtc : null
  const syncLabel = copy.sync[sync.status]

  if (!isDemo) {
    return (
      <div className="border-b border-[color:var(--color-border)] bg-white px-5 py-2 text-center text-xs text-[color:var(--color-text-muted)]">
        <span role="status">{syncLabel}</span>
      </div>
    )
  }

  const reset = async () => {
    if (resetting) return
    setResetting(true)
    setResetError(false)
    try {
      await auth.startDemo()
    } catch {
      setResetError(true)
    } finally {
      setResetting(false)
    }
  }

  const expiryLabel =
    expiresAt && Number.isFinite(Date.parse(expiresAt))
      ? tpl(copy.banner.expires, {
          date: format(new Date(expiresAt), 'PPp', { locale }),
        })
      : null

  return (
    <aside className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-amber-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold">{copy.banner.label}</p>
          <p className="text-xs leading-relaxed">
            {copy.banner.ephemeral}
            {expiryLabel ? ` ${expiryLabel}.` : ''}
          </p>
          <p role={resetError ? 'alert' : 'status'} className="mt-1 text-xs">
            {resetError ? copy.common.genericError : syncLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/registro"
            className="rounded-xl bg-apricot px-3 py-2 text-xs font-semibold text-white"
          >
            {copy.banner.register}
          </Link>
          <button
            type="button"
            disabled={resetting}
            onClick={() => void reset()}
            className="rounded-xl bg-white px-3 py-2 text-xs font-semibold ring-1 ring-amber-300 disabled:opacity-60"
          >
            {resetting ? copy.banner.resetting : copy.banner.reset}
          </button>
        </div>
      </div>
    </aside>
  )
}

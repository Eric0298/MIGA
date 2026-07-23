import { useState, type FormEvent } from 'react'
import { Download, KeyRound, LogOut, ShieldAlert, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useT } from '@/i18n/i18n-context'
import { formatBytes } from '@/lib/format-bytes'
import { tpl } from '@/i18n/tpl'
import { useWorkspaceSync } from '@/lib/sync/WorkspaceSyncProvider'
import { authCopyByLanguage } from './auth-copy'
import { authFieldClass, authPrimaryButtonClass, authSecondaryButtonClass } from './AuthLayout'
import { useAuth } from './AuthProvider'
import { confirmLogoutSafety, getLocalBlobSummary } from './logout-safety'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function AccountPanel() {
  const auth = useAuth()
  const sync = useWorkspaceSync()
  const navigate = useNavigate()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const [busy, setBusy] = useState<'logout' | 'password' | 'export' | 'delete' | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [exportPassword, setExportPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  if (!auth.session.authenticated) return null

  const logout = async () => {
    setBusy('logout')
    try {
      const confirmed = await confirmLogoutSafety({
        syncNow: sync.syncNow,
        inspectLocalBlobs: getLocalBlobSummary,
        confirm: (message) => window.confirm(message),
        unsyncedMessage: copy.account.logoutUnsynced,
        localFilesMessage: ({ count, bytes }) =>
          tpl(copy.account.logoutLocalFiles, {
            count,
            size: formatBytes(bytes),
          }),
      })
      if (!confirmed) return
      await auth.logout()
      navigate('/', { replace: true })
    } catch {
      toast.error(copy.common.genericError)
    } finally {
      setBusy(null)
    }
  }

  if (auth.session.accountType === 'demo') {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-charcoal">{copy.account.title}</h2>
        <div className="rounded-2xl bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-peach">
              <UserRound size={18} aria-hidden="true" />
            </span>
            <p className="text-sm text-charcoal">{copy.banner.ephemeral}</p>
          </div>
          <button
            type="button"
            className={`${authSecondaryButtonClass} mt-4`}
            disabled={busy !== null}
            onClick={() => void logout()}
          >
            {copy.account.logout}
          </button>
        </div>
      </section>
    )
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    if (newPassword !== newPasswordConfirmation) {
      toast.error(copy.common.passwordsMismatch)
      return
    }
    setBusy('password')
    try {
      await auth.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirmation('')
      toast.success(copy.account.passwordChanged)
    } catch {
      toast.error(copy.common.genericError)
    } finally {
      setBusy(null)
    }
  }

  const exportAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy('export')
    try {
      const synchronized = await sync.syncNow()
      if (!synchronized) throw new Error('Account export requires a synchronized workspace')
      await auth.reauthenticate(exportPassword)
      const blob = await auth.exportAccount()
      downloadBlob(blob, `miga-account-${new Date().toISOString().slice(0, 10)}.json`)
      setExportPassword('')
      toast.success(copy.account.exportSuccess)
    } catch {
      toast.error(copy.common.genericError)
    } finally {
      setBusy(null)
    }
  }

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || deleteConfirmation !== 'DELETE') return
    setBusy('delete')
    try {
      await auth.reauthenticate(deletePassword)
      await auth.deleteAccount(deletePassword)
      setDeletePassword('')
      setDeleteConfirmation('')
      navigate('/', { replace: true })
    } catch {
      toast.error(copy.common.genericError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-charcoal">{copy.account.title}</h2>
      <div className="rounded-2xl bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-peach">
            <UserRound size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-charcoal">
              {tpl(copy.account.signedInAs, { email: auth.session.email ?? '—' })}
            </p>
            <p role="status" className="mt-1 text-xs text-[color:var(--color-text-muted)]">
              {copy.sync[sync.status]}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`${authSecondaryButtonClass} mt-4 inline-flex items-center justify-center gap-2`}
          disabled={busy !== null}
          onClick={() => void logout()}
        >
          <LogOut size={17} aria-hidden="true" />
          {copy.account.logout}
        </button>
      </div>

      <details className="rounded-2xl bg-surface p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-charcoal">
          <KeyRound size={18} aria-hidden="true" />
          {copy.account.changePassword}
        </summary>
        <form className="mt-5 flex flex-col gap-3" onSubmit={changePassword}>
          <input
            className={authFieldClass}
            aria-label={copy.common.currentPassword}
            placeholder={copy.common.currentPassword}
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <input
            className={authFieldClass}
            aria-label={copy.common.newPassword}
            placeholder={copy.common.newPassword}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <input
            className={authFieldClass}
            aria-label={copy.common.confirmPassword}
            placeholder={copy.common.confirmPassword}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={newPasswordConfirmation}
            onChange={(event) => setNewPasswordConfirmation(event.target.value)}
          />
          <button className={authPrimaryButtonClass} type="submit" disabled={busy !== null}>
            {copy.account.changePassword}
          </button>
        </form>
      </details>

      <details className="rounded-2xl bg-surface p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-charcoal">
          <Download size={18} aria-hidden="true" />
          {copy.account.export}
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-[color:var(--color-text-muted)]">
          {copy.account.exportHint} {copy.account.reauthHint}
        </p>
        <form className="mt-4 flex flex-col gap-3" onSubmit={exportAccount}>
          <input
            className={authFieldClass}
            aria-label={copy.common.currentPassword}
            placeholder={copy.common.currentPassword}
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={exportPassword}
            onChange={(event) => setExportPassword(event.target.value)}
          />
          <button className={authPrimaryButtonClass} type="submit" disabled={busy !== null}>
            {copy.account.export}
          </button>
        </form>
      </details>

      <details className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold text-red-900">
          <ShieldAlert size={18} aria-hidden="true" />
          {copy.account.deleteTitle}
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-red-800">{copy.account.deleteHint}</p>
        <form className="mt-4 flex flex-col gap-3" onSubmit={deleteAccount}>
          <input
            className={authFieldClass}
            aria-label={copy.common.currentPassword}
            placeholder={copy.common.currentPassword}
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
          <input
            className={authFieldClass}
            aria-label={copy.account.deleteConfirm}
            placeholder={copy.account.deleteConfirm}
            type="text"
            autoComplete="off"
            required
            pattern="DELETE"
            maxLength={6}
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
          />
          <button
            className="w-full rounded-2xl bg-red-700 px-5 py-3.5 text-base font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={busy !== null || deleteConfirmation !== 'DELETE'}
          >
            {copy.account.deleteAction}
          </button>
        </form>
      </details>
    </section>
  )
}

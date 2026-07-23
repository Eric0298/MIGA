import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { useWorkspaceSync } from '@/lib/sync/WorkspaceSyncProvider'
import { authCopyByLanguage } from './auth-copy'
import { AuthError, AuthLayout, authFieldClass, authPrimaryButtonClass } from './AuthLayout'
import { useAuth } from './AuthProvider'

function RegisterPage() {
  const auth = useAuth()
  const sync = useWorkspaceSync()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const navigate = useNavigate()
  const isDemo = auth.session.authenticated && auth.session.accountType === 'demo'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [importDemoData, setImportDemoData] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (
    auth.status === 'ready' &&
    auth.session.authenticated &&
    auth.session.accountType === 'registered'
  ) {
    return <Navigate to="/app" replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    if (password !== confirmation) {
      setError(copy.common.passwordsMismatch)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (isDemo && importDemoData && !(await sync.syncNow())) {
        setError(copy.register.importDemoSyncError)
        return
      }
      const session = await auth.register({
        email: email.trim(),
        password,
        privacyPolicyVersion: '2026-07-23',
        importDemoData: isDemo && importDemoData,
      })
      if (session.authenticated && session.accountType === 'registered') {
        navigate('/app', { replace: true })
      } else navigate('/verificar-email', { replace: true, state: { email: email.trim() } })
    } catch {
      setError(copy.common.genericError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={copy.register.title} subtitle={copy.register.subtitle}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <AuthError message={error} />
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal">
          {copy.common.email}
          <input
            className={authFieldClass}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal">
          {copy.common.password}
          <input
            className={authFieldClass}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="font-normal text-[color:var(--color-text-muted)]">
            {copy.common.passwordHint}
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal">
          {copy.common.confirmPassword}
          <input
            className={authFieldClass}
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm text-charcoal">
          <input
            className="mt-1 h-4 w-4 accent-apricot"
            type="checkbox"
            required
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>
            {copy.register.acceptPrivacy}{' '}
            <Link className="font-semibold text-apricot underline" to="/privacidad">
              {copy.common.privacy}
            </Link>
          </span>
        </label>
        {isDemo && (
          <label className="flex items-start gap-3 rounded-2xl bg-peach/60 p-4 text-sm text-charcoal">
            <input
              className="mt-1 h-4 w-4 accent-apricot"
              type="checkbox"
              checked={importDemoData}
              onChange={(event) => setImportDemoData(event.target.checked)}
            />
            <span>
              <span className="block font-semibold">{copy.register.importDemo}</span>
              <span className="mt-1 block text-xs text-[color:var(--color-text-muted)]">
                {copy.register.importDemoHint}
              </span>
            </span>
          </label>
        )}
        <button className={authPrimaryButtonClass} type="submit" disabled={busy || !accepted}>
          {copy.register.submit}
        </button>
      </form>
      <p className="mt-7 text-center text-sm text-[color:var(--color-text-muted)]">
        {copy.register.hasAccount}{' '}
        <Link className="font-semibold text-apricot" to="/login">
          {copy.register.login}
        </Link>
      </p>
    </AuthLayout>
  )
}

export default RegisterPage

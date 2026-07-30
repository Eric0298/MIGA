import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { ApiError } from '@/lib/api/http'
import { authCopyByLanguage } from './auth-copy'
import {
  AuthError,
  AuthLayout,
  AuthSuccess,
  authFieldClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
} from './AuthLayout'
import { useAuth } from './AuthProvider'
import { consumeAuthLinkParameters } from './auth-link'
import {
  clearDemoImportPreference,
  readDemoImportPreference,
  rememberDemoImportPreference,
} from './demo-import-preference'

function VerifyEmailPage() {
  const auth = useAuth()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const navigate = useNavigate()
  const location = useLocation()
  const [link] = useState(() =>
    consumeAuthLinkParameters(location.hash, location.search, ['userId', 'token']),
  )
  const userId = link.values.userId ?? ''
  const token = link.values.token ?? ''
  const canConfirm = userId.length > 0 && token.length > 0
  const navigationState = location.state as {
    email?: unknown
    importDemoData?: unknown
  } | null
  const stateEmail = typeof navigationState?.email === 'string' ? navigationState.email : undefined
  const navigationImportDemoData =
    typeof navigationState?.importDemoData === 'boolean' ? navigationState.importDemoData : null
  const demoWorkspaceId =
    auth.session.authenticated && auth.session.accountType === 'demo'
      ? auth.session.workspaceId
      : null
  const isDemo = demoWorkspaceId !== null
  const sessionEmail = auth.session.authenticated ? auth.session.email : undefined
  const [email, setEmail] = useState(sessionEmail ?? stateEmail ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [importDemoData, setImportDemoData] = useState(() =>
    navigationImportDemoData !== null
      ? navigationImportDemoData
      : demoWorkspaceId
        ? readDemoImportPreference(demoWorkspaceId)
        : false,
  )
  const initializedDemoWorkspaceRef = useRef<string | null>(demoWorkspaceId)
  const [busy, setBusy] = useState<'confirm' | 'resend' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (link.containedSensitiveParameters) {
      window.history.replaceState(
        window.history.state,
        '',
        `${location.pathname}${link.sanitizedSearch}`,
      )
    }
  }, [link, location.pathname])

  useEffect(() => {
    if (!demoWorkspaceId || initializedDemoWorkspaceRef.current === demoWorkspaceId) return
    initializedDemoWorkspaceRef.current = demoWorkspaceId
    setImportDemoData(navigationImportDemoData ?? readDemoImportPreference(demoWorkspaceId))
  }, [demoWorkspaceId, navigationImportDemoData])

  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !canConfirm || auth.status === 'loading') return
    if (password !== confirmation) {
      setError(copy.common.passwordsMismatch)
      return
    }
    setBusy('confirm')
    setError(null)
    try {
      const input = {
        userId,
        token,
        newPassword: password,
        privacyPolicyVersion: '2026-07-23',
        importDemoData: isDemo && importDemoData,
        continueWithoutDemoData: isDemo && !importDemoData,
      } as const
      try {
        await auth.confirmEmail(input)
      } catch (cause) {
        if (
          !(cause instanceof ApiError) ||
          cause.status !== 409 ||
          cause.problem?.code !== 'demo_conversion_unavailable'
        ) {
          throw cause
        }
        if (!window.confirm(copy.verify.continueWithoutDemoDataConfirm)) {
          setError(copy.verify.demoDataPreserved)
          return
        }
        setImportDemoData(false)
        clearDemoImportPreference()
        await auth.confirmEmail({
          ...input,
          importDemoData: false,
          continueWithoutDemoData: true,
        })
      }
      clearDemoImportPreference()
      setSuccess(copy.verify.success)
      navigate('/login', { replace: true })
    } catch {
      setError(copy.common.genericError)
    } finally {
      setBusy(null)
    }
  }

  const resend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !email.trim()) return
    setBusy('resend')
    setError(null)
    try {
      await auth.resendConfirmation(email.trim())
      setSuccess(copy.verify.sent)
    } catch {
      setError(copy.common.genericError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AuthLayout title={copy.verify.title} subtitle={copy.verify.subtitle}>
      <div className="flex flex-col gap-4">
        <AuthError message={error} />
        <AuthSuccess message={success} />
        {canConfirm && (
          <form className="flex flex-col gap-4" onSubmit={confirm}>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal">
              {copy.common.newPassword}
              <input
                className={authFieldClass}
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                disabled={busy !== null || auth.status === 'loading'}
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
                disabled={busy !== null || auth.status === 'loading'}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm text-charcoal">
              <input
                className="mt-1 h-4 w-4 accent-apricot"
                type="checkbox"
                required
                disabled={busy !== null || auth.status === 'loading'}
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
                  disabled={busy !== null || auth.status === 'loading'}
                  checked={importDemoData}
                  onChange={(event) => {
                    const checked = event.target.checked
                    setImportDemoData(checked)
                    if (demoWorkspaceId) {
                      rememberDemoImportPreference(demoWorkspaceId, checked)
                    }
                  }}
                />
                <span>
                  <span className="block font-semibold">{copy.register.importDemo}</span>
                  <span className="mt-1 block text-xs text-[color:var(--color-text-muted)]">
                    {copy.register.importDemoHint}
                  </span>
                </span>
              </label>
            )}
            <button
              className={authPrimaryButtonClass}
              type="submit"
              disabled={busy !== null || auth.status === 'loading' || !accepted}
            >
              {copy.verify.confirm}
            </button>
          </form>
        )}
        {!canConfirm && <AuthError message={copy.verify.invalidLink} />}
        <form
          className="flex flex-col gap-3 border-t border-[color:var(--color-border)] pt-5"
          onSubmit={resend}
        >
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
          <button className={authSecondaryButtonClass} type="submit" disabled={busy !== null}>
            {copy.verify.resend}
          </button>
        </form>
        <Link className="text-center text-sm font-semibold text-apricot" to="/login">
          {copy.login.title}
        </Link>
      </div>
    </AuthLayout>
  )
}

export default VerifyEmailPage

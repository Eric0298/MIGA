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
import { clearDemoImportPreference, readDemoImportPreference } from './demo-import-preference'

type ConfirmationPhase = 'idle' | 'verifying' | 'success' | 'failed'

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
  const [phase, setPhase] = useState<ConfirmationPhase>(canConfirm ? 'verifying' : 'idle')
  const [error, setError] = useState<string | null>(null)
  const [resendBusy, setResendBusy] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const successHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const confirmationStartedRef = useRef(false)

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
    if (!canConfirm || confirmationStartedRef.current) return
    if (auth.status === 'loading') return
    // React StrictMode invokes effects twice in development; the ref guards
    // against a second submission consuming the single-use token.
    confirmationStartedRef.current = true
    const importDemoData = isDemo
      ? navigationImportDemoData !== null
        ? navigationImportDemoData
        : readDemoImportPreference(demoWorkspaceId)
      : false
    const base = { userId, token } as const
    void (async () => {
      try {
        try {
          await auth.confirmEmail({
            ...base,
            importDemoData,
            continueWithoutDemoData: isDemo && !importDemoData,
          })
        } catch (cause) {
          if (
            !(cause instanceof ApiError) ||
            cause.status !== 409 ||
            cause.problem?.code !== 'demo_conversion_unavailable'
          ) {
            throw cause
          }
          await auth.confirmEmail({
            ...base,
            importDemoData: false,
            continueWithoutDemoData: true,
          })
        }
        clearDemoImportPreference()
        setPhase('success')
      } catch {
        setPhase('failed')
        setError(copy.verify.failed)
      }
    })()
  }, [
    auth,
    auth.status,
    canConfirm,
    copy.verify.failed,
    demoWorkspaceId,
    isDemo,
    navigationImportDemoData,
    token,
    userId,
  ])

  useEffect(() => {
    if (phase === 'success') successHeadingRef.current?.focus()
  }, [phase])

  const resend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (resendBusy || !email.trim()) return
    setResendBusy(true)
    setError(null)
    setResendMessage(null)
    try {
      await auth.resendConfirmation(email.trim())
      setResendMessage(copy.verify.sent)
    } catch {
      setError(copy.common.genericError)
    } finally {
      setResendBusy(false)
    }
  }

  if (canConfirm && phase !== 'failed') {
    return (
      <AuthLayout title={copy.verify.title} subtitle={copy.verify.subtitle}>
        <div className="flex flex-col gap-4">
          {phase === 'verifying' && (
            <p role="status" aria-live="polite" className="text-sm text-charcoal">
              {copy.verify.verifying}
            </p>
          )}
          {phase === 'success' && (
            <>
              <AuthSuccess message={copy.verify.success} />
              <h2
                ref={successHeadingRef}
                tabIndex={-1}
                className="text-lg font-semibold text-charcoal"
              >
                {copy.verify.successHeading}
              </h2>
              <p className="text-sm text-[color:var(--color-text-muted)]">
                {copy.verify.successBody}
              </p>
              <button
                type="button"
                className={authPrimaryButtonClass}
                onClick={() => navigate('/login', { replace: true })}
              >
                {copy.login.title}
              </button>
            </>
          )}
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={copy.verify.title} subtitle={copy.verify.subtitle}>
      <div className="flex flex-col gap-4">
        <AuthError message={error} />
        <AuthSuccess message={resendMessage} />
        {!canConfirm && <AuthError message={copy.verify.invalidLink} />}
        <form className="flex flex-col gap-3" onSubmit={resend}>
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
          <button
            className={authSecondaryButtonClass}
            type="submit"
            disabled={resendBusy}
            aria-busy={resendBusy}
          >
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

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useT } from '@/i18n/i18n-context'
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
  const stateEmail = (location.state as { email?: string } | null)?.email
  const sessionEmail = auth.session.authenticated ? auth.session.email : undefined
  const [email, setEmail] = useState(sessionEmail ?? stateEmail ?? '')
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

  const confirm = async () => {
    if (busy || !canConfirm) return
    setBusy('confirm')
    setError(null)
    try {
      await auth.confirmEmail({ userId, token })
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
          <button
            className={authPrimaryButtonClass}
            type="button"
            disabled={busy !== null}
            onClick={confirm}
          >
            {copy.verify.confirm}
          </button>
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

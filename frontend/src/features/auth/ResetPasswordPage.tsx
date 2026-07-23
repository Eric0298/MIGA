import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from './auth-copy'
import {
  AuthError,
  AuthLayout,
  AuthSuccess,
  authFieldClass,
  authPrimaryButtonClass,
} from './AuthLayout'
import { useAuth } from './AuthProvider'
import { consumeAuthLinkParameters } from './auth-link'

function ResetPasswordPage() {
  const auth = useAuth()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const location = useLocation()
  const [link] = useState(() =>
    consumeAuthLinkParameters(location.hash, location.search, ['email', 'token']),
  )
  const email = link.values.email?.trim() ?? ''
  const token = link.values.token ?? ''
  const validLink = email.length > 0 && token.length > 0
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !validLink) return
    if (password !== confirmation) {
      setError(copy.common.passwordsMismatch)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await auth.resetPassword({ email, token, newPassword: password })
      setSuccess(copy.reset.success)
      setPassword('')
      setConfirmation('')
    } catch {
      setError(copy.common.genericError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={copy.reset.title} subtitle={copy.reset.subtitle}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <AuthError message={!validLink ? copy.reset.invalidLink : error} />
        <AuthSuccess message={success} />
        {validLink && !success && (
          <>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-charcoal">
              {copy.common.newPassword}
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
            <button className={authPrimaryButtonClass} type="submit" disabled={busy}>
              {copy.reset.submit}
            </button>
          </>
        )}
        <Link className="text-center text-sm font-semibold text-apricot" to="/login">
          {copy.login.title}
        </Link>
      </form>
    </AuthLayout>
  )
}

export default ResetPasswordPage

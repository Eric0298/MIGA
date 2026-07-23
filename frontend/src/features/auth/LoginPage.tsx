import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from './auth-copy'
import { AuthError, AuthLayout, authFieldClass, authPrimaryButtonClass } from './AuthLayout'
import { useAuth } from './AuthProvider'

function LoginPage() {
  const auth = useAuth()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (auth.status === 'ready' && auth.session.authenticated) {
    return <Navigate to="/app" replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await auth.login(email.trim(), password)
      const requested = (location.state as { from?: string } | null)?.from
      navigate(requested?.startsWith('/app') ? requested : '/app', { replace: true })
    } catch {
      setError(copy.common.genericError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={copy.login.title} subtitle={copy.login.subtitle}>
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
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className={authPrimaryButtonClass} type="submit" disabled={busy}>
          {copy.login.submit}
        </button>
        <Link className="text-center text-sm font-semibold text-apricot" to="/recuperar">
          {copy.login.forgot}
        </Link>
      </form>
      <p className="mt-7 text-center text-sm text-[color:var(--color-text-muted)]">
        {copy.login.noAccount}{' '}
        <Link className="font-semibold text-apricot" to="/registro">
          {copy.login.register}
        </Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage

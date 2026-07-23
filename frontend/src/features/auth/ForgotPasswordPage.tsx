import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
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

function ForgotPasswordPage() {
  const auth = useAuth()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      await auth.forgotPassword(email.trim())
      setSuccess(copy.forgot.success)
    } catch {
      setError(copy.common.genericError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={copy.forgot.title} subtitle={copy.forgot.subtitle}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <AuthError message={error} />
        <AuthSuccess message={success} />
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
        <button className={authPrimaryButtonClass} type="submit" disabled={busy}>
          {copy.forgot.submit}
        </button>
        <Link className="text-center text-sm font-semibold text-apricot" to="/login">
          {copy.login.title}
        </Link>
      </form>
    </AuthLayout>
  )
}

export default ForgotPasswordPage

import { Navigate, useLocation } from 'react-router'
import AppShell from '@/components/layout/AppShell'
import Loading from '@/components/ui/Loading'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from './auth-copy'
import { authPrimaryButtonClass } from './AuthLayout'
import { useAuth } from './AuthProvider'

export type AppGuardDecision =
  'loading' | 'error' | 'login' | 'verify-email' | 'workspace' | 'allow'

export function getAppGuardDecision({
  status,
  authenticated,
  emailConfirmed,
  hasWorkspace,
}: {
  status: 'loading' | 'ready' | 'error'
  authenticated: boolean
  emailConfirmed?: boolean | null
  hasWorkspace: boolean
}): AppGuardDecision {
  if (status === 'loading') return 'loading'
  if (status === 'error') return 'error'
  if (!authenticated) return 'login'
  if (emailConfirmed === false) return 'verify-email'
  if (!hasWorkspace) return 'workspace'
  return 'allow'
}

function ProtectedAppRoute() {
  const auth = useAuth()
  const location = useLocation()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const decision = getAppGuardDecision({
    status: auth.status,
    authenticated: auth.session.authenticated,
    emailConfirmed: auth.session.authenticated ? auth.session.emailConfirmed : undefined,
    hasWorkspace: auth.workspace !== null,
  })

  if (decision === 'loading' || decision === 'workspace') return <Loading fullscreen />
  if (decision === 'error') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <p role="alert" className="text-sm text-red-800">
          {copy.common.genericError}
        </p>
        <button
          type="button"
          className={authPrimaryButtonClass}
          onClick={() => void auth.refreshSession()}
        >
          {copy.demo.retry}
        </button>
      </main>
    )
  }
  if (decision === 'login') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }
  if (decision === 'verify-email') {
    return (
      <Navigate
        to="/verificar-email"
        replace
        state={{
          email: auth.session.authenticated ? auth.session.email : undefined,
        }}
      />
    )
  }

  return <AppShell key={auth.workspace!.scopeKey} />
}

export default ProtectedAppRoute

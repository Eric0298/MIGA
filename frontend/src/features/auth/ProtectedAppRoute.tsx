import { Navigate, useLocation } from 'react-router'
import AppShell from '@/components/layout/AppShell'
import Loading from '@/components/ui/Loading'
import { useAuth } from './AuthProvider'

export type AppGuardDecision = 'loading' | 'login' | 'verify-email' | 'workspace' | 'allow'

export function getAppGuardDecision({
  status,
  authenticated,
  emailConfirmed,
  hasWorkspace,
  requiresLogin = false,
}: {
  status: 'loading' | 'ready' | 'error'
  authenticated: boolean
  emailConfirmed?: boolean | null
  hasWorkspace: boolean
  requiresLogin?: boolean
}): AppGuardDecision {
  if (status === 'loading') return 'loading'
  if (!authenticated && requiresLogin) return 'login'
  if (status === 'error' || !authenticated) return 'allow'
  if (emailConfirmed === false) return 'verify-email'
  if (!hasWorkspace) return 'workspace'
  return 'allow'
}

function ProtectedAppRoute() {
  const auth = useAuth()
  const location = useLocation()
  const decision = getAppGuardDecision({
    status: auth.status,
    authenticated: auth.session.authenticated,
    emailConfirmed: auth.session.authenticated ? auth.session.emailConfirmed : undefined,
    hasWorkspace: auth.workspace !== null,
    requiresLogin: auth.requiresLogin,
  })

  if (decision === 'loading' || decision === 'workspace') return <Loading fullscreen />
  if (decision === 'login') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
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

  return <AppShell key={auth.workspace?.scopeKey ?? 'local'} />
}

export default ProtectedAppRoute

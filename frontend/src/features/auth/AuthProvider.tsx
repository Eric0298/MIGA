import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  changePassword as changePasswordRequest,
  confirmEmail as confirmEmailRequest,
  deleteAccount as deleteAccountRequest,
  exportAccount as exportAccountRequest,
  forgotPassword as forgotPasswordRequest,
  getAuthSession,
  login as loginRequest,
  logout as logoutRequest,
  reauthenticate as reauthenticateRequest,
  register as registerRequest,
  resendConfirmation as resendConfirmationRequest,
  resetPassword as resetPasswordRequest,
  startDemo as startDemoRequest,
  type AuthSession,
  type ConfirmEmailInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@/lib/api/auth-api'
import { deactivateScopedDatabase, getActiveDatabaseScope } from '@/lib/db/miga-db'
import {
  bootstrapAuthenticatedWorkspace,
  scopeKeyForSession,
  type WorkspaceBootstrapResult,
} from '@/lib/sync/workspace-bootstrap'

type AuthStatus = 'loading' | 'ready' | 'error'

type AuthState = {
  status: AuthStatus
  session: AuthSession
  workspace: WorkspaceBootstrapResult | null
  error: Error | null
}

type AuthContextValue = AuthState & {
  refreshSession: () => Promise<AuthSession>
  startDemo: () => Promise<AuthSession>
  register: (input: RegisterInput) => Promise<AuthSession>
  login: (email: string, password: string) => Promise<AuthSession>
  logout: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (input: ResetPasswordInput) => Promise<void>
  confirmEmail: (input: ConfirmEmailInput) => Promise<AuthSession>
  resendConfirmation: (email: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  reauthenticate: (currentPassword: string) => Promise<void>
  exportAccount: () => Promise<Blob>
  deleteAccount: (currentPassword: string) => Promise<void>
}

const EMPTY_SESSION: AuthSession = {
  authenticated: false,
  accountType: null,
}

const INITIAL_STATE: AuthState = {
  status: 'loading',
  session: EMPTY_SESSION,
  workspace: null,
  error: null,
}

const AuthContext = createContext<AuthContextValue | null>(null)
const AUTH_CHANNEL_NAME = 'miga-auth-state-v1'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE)
  const stateRef = useRef<AuthState>(INITIAL_STATE)
  const requestGeneration = useRef(0)
  const channelRef = useRef<BroadcastChannel | null>(null)

  const loadSession = useCallback(async (forceWorkspace = false): Promise<AuthSession> => {
    const generation = ++requestGeneration.current
    setState((current) => ({ ...current, status: 'loading', error: null }))

    try {
      const session = await getAuthSession()
      if (generation !== requestGeneration.current) {
        throw new DOMException('Session request superseded', 'AbortError')
      }

      if (!session.authenticated) {
        // A missing/expired cookie is not consent to destroy device-local
        // attachments. Close the scope so its data cannot be exposed through
        // repositories, but retain it for a later login to the same workspace.
        await deactivateScopedDatabase(false)
        if (generation !== requestGeneration.current) {
          throw new DOMException('Session request superseded', 'AbortError')
        }
        const next = { status: 'ready', session, workspace: null, error: null } satisfies AuthState
        stateRef.current = next
        setState(next)
        return session
      }

      const current = stateRef.current
      const scopeKey = await scopeKeyForSession(session)
      if (
        !forceWorkspace &&
        current.workspace?.scopeKey === scopeKey &&
        getActiveDatabaseScope() === scopeKey
      ) {
        const next = {
          status: 'ready',
          session,
          workspace: current.workspace,
          error: null,
        } satisfies AuthState
        stateRef.current = next
        setState(next)
        return session
      }

      const workspace = await bootstrapAuthenticatedWorkspace(session)
      if (generation !== requestGeneration.current) {
        throw new DOMException('Session request superseded', 'AbortError')
      }
      const next = { status: 'ready', session, workspace, error: null } satisfies AuthState
      stateRef.current = next
      setState(next)
      return session
    } catch (cause) {
      if (generation !== requestGeneration.current) throw cause
      const error = cause instanceof Error ? cause : new Error('Could not load the session')
      setState((current) => ({ ...current, status: 'error', error }))
      throw error
    }
  }, [])

  const refreshSession = useCallback(() => loadSession(false), [loadSession])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    void refreshSession().catch(() => undefined)
    return () => {
      requestGeneration.current += 1
    }
  }, [refreshSession])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (
        !event.data ||
        typeof event.data !== 'object' ||
        (event.data as { type?: unknown }).type !== 'session-invalidated'
      ) {
        return
      }
      requestGeneration.current += 1
      const next = {
        status: 'loading',
        session: EMPTY_SESSION,
        workspace: null,
        error: null,
      } satisfies AuthState
      stateRef.current = next
      setState(next)
      void deactivateScopedDatabase(true)
        .then(() => {
          const ready = { ...next, status: 'ready' } satisfies AuthState
          stateRef.current = ready
          setState(ready)
        })
        .catch((cause) => {
          const error = cause instanceof Error ? cause : new Error('Could not clear local data')
          setState({ ...next, status: 'error', error })
        })
    }
    return () => {
      channel.close()
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [])

  useEffect(() => {
    const validateWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession().catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', validateWhenVisible)
    return () => document.removeEventListener('visibilitychange', validateWhenVisible)
  }, [refreshSession])

  useEffect(() => {
    if (state.status !== 'ready' || !state.session.authenticated || !state.session.expiresAtUtc) {
      return
    }
    const expiresAt = Date.parse(state.session.expiresAtUtc)
    if (!Number.isFinite(expiresAt)) return
    const delay = Math.max(1_000, Math.min(expiresAt - Date.now() + 1_000, 2_147_000_000))
    const timer = window.setTimeout(() => void refreshSession().catch(() => undefined), delay)
    return () => window.clearTimeout(timer)
  }, [state.status, state.session, refreshSession])

  const refreshAfter = useCallback(
    async (operation: () => Promise<void>, forceWorkspace = true) => {
      await operation()
      return loadSession(forceWorkspace)
    },
    [loadSession],
  )

  const startDemo = useCallback(() => refreshAfter(startDemoRequest), [refreshAfter])

  const register = useCallback(
    (input: RegisterInput) => refreshAfter(() => registerRequest(input)),
    [refreshAfter],
  )

  const login = useCallback(
    (email: string, password: string) => refreshAfter(() => loginRequest(email, password)),
    [refreshAfter],
  )

  const logout = useCallback(async () => {
    await logoutRequest()
    requestGeneration.current += 1
    channelRef.current?.postMessage({ type: 'session-invalidated' })
    const loading = {
      status: 'loading',
      session: EMPTY_SESSION,
      workspace: null,
      error: null,
    } satisfies AuthState
    stateRef.current = loading
    setState(loading)
    await Promise.resolve()
    await deactivateScopedDatabase(true)
    const ready = { ...loading, status: 'ready' } satisfies AuthState
    stateRef.current = ready
    setState(ready)
  }, [])

  const confirmEmail = useCallback(
    (input: ConfirmEmailInput) => refreshAfter(() => confirmEmailRequest(input), false),
    [refreshAfter],
  )

  const deleteAccount = useCallback(async (currentPassword: string) => {
    await deleteAccountRequest(currentPassword)
    requestGeneration.current += 1
    channelRef.current?.postMessage({ type: 'session-invalidated' })
    const loading = {
      status: 'loading',
      session: EMPTY_SESSION,
      workspace: null,
      error: null,
    } satisfies AuthState
    stateRef.current = loading
    setState(loading)
    await Promise.resolve()
    await deactivateScopedDatabase(true)
    const ready = { ...loading, status: 'ready' } satisfies AuthState
    stateRef.current = ready
    setState(ready)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refreshSession,
      startDemo,
      register,
      login,
      logout,
      forgotPassword: forgotPasswordRequest,
      resetPassword: resetPasswordRequest,
      confirmEmail,
      resendConfirmation: resendConfirmationRequest,
      changePassword: changePasswordRequest,
      reauthenticate: reauthenticateRequest,
      exportAccount: exportAccountRequest,
      deleteAccount,
    }),
    [state, refreshSession, startDemo, register, login, logout, confirmEmail, deleteAccount],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

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
  listAccountSessions as listAccountSessionsRequest,
  logout as logoutRequest,
  reauthenticate as reauthenticateRequest,
  register as registerRequest,
  resendConfirmation as resendConfirmationRequest,
  resetPassword as resetPasswordRequest,
  revokeAccountSession as revokeAccountSessionRequest,
  revokeOtherAccountSessions as revokeOtherAccountSessionsRequest,
  startDemo as startDemoRequest,
  type AuthSession,
  type AccountSession,
  type ConfirmEmailInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@/lib/api/auth-api'
import { ApiError, subscribeToApiAuthorizationFailures } from '@/lib/api/http'
import {
  deactivateScopedDatabase,
  deleteLocalDatabaseForScope,
  getActiveDatabaseScope,
} from '@/lib/db/miga-db'
import { abortActiveWorkspaceSync } from '@/lib/sync/WorkspaceSyncProvider'
import {
  bootstrapAuthenticatedWorkspace,
  scopeKeyForSession,
  type WorkspaceBootstrapResult,
} from '@/lib/sync/workspace-bootstrap'
import { clearDemoImportPreference } from './demo-import-preference'

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
  deleteLocalData: () => Promise<void>
  listAccountSessions: () => Promise<AccountSession[]>
  revokeAccountSession: (sessionId: string) => Promise<void>
  revokeOtherAccountSessions: () => Promise<void>
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (input: ResetPasswordInput) => Promise<void>
  confirmEmail: (input: ConfirmEmailInput) => Promise<AuthSession>
  resendConfirmation: (email: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  reauthenticate: (currentPassword: string) => Promise<void>
  exportAccount: () => Promise<Blob>
  deleteAccount: (currentPassword: string) => Promise<void>
}

type AuthChannelMessage = {
  type: 'session-invalidated'
  deleteLocalData: boolean
  scopeKey: string | null
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
const SCOPE_PATTERN = /^[a-f0-9]{24,64}$/
const SESSION_BOUND_AUTH_PATHS = new Set([
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/auth/reauthenticate',
])

function isSessionBoundApiPath(path: string): boolean {
  return (
    path.startsWith('/api/data/') ||
    path === '/api/account' ||
    path.startsWith('/api/account/') ||
    SESSION_BOUND_AUTH_PATHS.has(path)
  )
}

function parseChannelMessage(raw: unknown): AuthChannelMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<AuthChannelMessage>
  if (
    value.type !== 'session-invalidated' ||
    typeof value.deleteLocalData !== 'boolean' ||
    !(
      value.scopeKey === null ||
      (typeof value.scopeKey === 'string' && SCOPE_PATTERN.test(value.scopeKey))
    )
  ) {
    return null
  }
  return value as AuthChannelMessage
}

function abortError(): DOMException {
  return new DOMException('Session request superseded', 'AbortError')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE)
  const stateRef = useRef<AuthState>(INITIAL_STATE)
  const requestGeneration = useRef(0)
  const sessionAbortRef = useRef<AbortController | null>(null)
  const channelRef = useRef<BroadcastChannel | null>(null)
  const lastReadyAuthenticatedStateRef = useRef<AuthState | null>(null)
  const authorizationRevalidationRef = useRef<{
    retainAuthenticatedOnFailure: boolean
  } | null>(null)

  const commitState = useCallback((next: AuthState) => {
    if (next.status === 'ready') {
      lastReadyAuthenticatedStateRef.current =
        next.session.authenticated && next.workspace ? next : null
    }
    stateRef.current = next
    setState(next)
  }, [])

  const beginTransition = useCallback((): { generation: number; previous: AuthState } => {
    const previous = stateRef.current
    const generation = ++requestGeneration.current
    sessionAbortRef.current?.abort()
    sessionAbortRef.current = null
    abortActiveWorkspaceSync()
    commitState({
      status: 'loading',
      session: EMPTY_SESSION,
      workspace: null,
      error: null,
    })
    return { generation, previous }
  }, [commitState])

  const loadSession = useCallback(
    async (
      forceWorkspace = false,
      retainAuthenticatedOnTransientFailure = true,
      fallbackOverride?: AuthState,
    ): Promise<AuthSession> => {
      const fallback = fallbackOverride ?? stateRef.current
      const generation = ++requestGeneration.current
      sessionAbortRef.current?.abort()
      const controller = new AbortController()
      sessionAbortRef.current = controller
      if (fallback.status !== 'ready') {
        commitState({ ...fallback, status: 'loading', error: null })
      }

      try {
        const session = await getAuthSession(controller.signal)
        if (generation !== requestGeneration.current) throw abortError()

        if (!session.authenticated) {
          abortActiveWorkspaceSync()
          await deactivateScopedDatabase()
          if (generation !== requestGeneration.current) throw abortError()
          commitState({ status: 'ready', session, workspace: null, error: null })
          return session
        }

        const current = stateRef.current.status === 'loading' ? fallback : stateRef.current
        const scopeKey = await scopeKeyForSession(session)
        if (
          !forceWorkspace &&
          current.workspace?.scopeKey === scopeKey &&
          getActiveDatabaseScope() === scopeKey
        ) {
          commitState({
            status: 'ready',
            session,
            workspace: current.workspace,
            error: null,
          })
          return session
        }

        if (current.workspace && current.workspace.scopeKey !== scopeKey) {
          abortActiveWorkspaceSync()
        }
        const workspace = await bootstrapAuthenticatedWorkspace(session, controller.signal)
        if (generation !== requestGeneration.current) throw abortError()
        commitState({ status: 'ready', session, workspace, error: null })
        return session
      } catch (cause) {
        if (generation !== requestGeneration.current || controller.signal.aborted) throw cause
        const error = cause instanceof Error ? cause : new Error('Could not load the session')

        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
          abortActiveWorkspaceSync()
          await deactivateScopedDatabase()
          commitState({ status: 'ready', session: EMPTY_SESSION, workspace: null, error })
          return EMPTY_SESSION
        }

        if (
          retainAuthenticatedOnTransientFailure &&
          fallback.status === 'ready' &&
          fallback.session.authenticated &&
          fallback.workspace &&
          getActiveDatabaseScope() === fallback.workspace.scopeKey
        ) {
          commitState({ ...fallback, status: 'ready', error })
          return fallback.session
        }

        abortActiveWorkspaceSync()
        await deactivateScopedDatabase()
        commitState({ status: 'ready', session: EMPTY_SESSION, workspace: null, error })
        return EMPTY_SESSION
      } finally {
        if (sessionAbortRef.current === controller) sessionAbortRef.current = null
      }
    },
    [commitState],
  )

  const refreshSession = useCallback(() => loadSession(false), [loadSession])

  useEffect(
    () =>
      subscribeToApiAuthorizationFailures(({ path, error }) => {
        if (!isSessionBoundApiPath(path)) return
        const retainAuthenticatedOnFailure =
          (error.status === 403 && error.problem?.code === 'reauthentication_required') ||
          (error.status === 401 && error.problem?.code === 'invalid_credentials')
        const active = authorizationRevalidationRef.current
        if (active && (!active.retainAuthenticatedOnFailure || retainAuthenticatedOnFailure)) {
          return
        }

        const marker = { retainAuthenticatedOnFailure }
        authorizationRevalidationRef.current = marker
        const fallback = retainAuthenticatedOnFailure
          ? (lastReadyAuthenticatedStateRef.current ?? undefined)
          : undefined
        void loadSession(false, retainAuthenticatedOnFailure, fallback)
          .then(() => undefined)
          .catch(() => undefined)
          .finally(() => {
            if (authorizationRevalidationRef.current === marker) {
              authorizationRevalidationRef.current = null
            }
          })
      }),
    [loadSession],
  )

  useEffect(() => {
    void refreshSession().catch(() => undefined)
    return () => {
      requestGeneration.current += 1
      sessionAbortRef.current?.abort()
      abortActiveWorkspaceSync()
    }
  }, [refreshSession])

  const applyInvalidation = useCallback(
    async (message: AuthChannelMessage) => {
      const generation = ++requestGeneration.current
      sessionAbortRef.current?.abort()
      abortActiveWorkspaceSync()
      commitState({
        status: 'loading',
        session: EMPTY_SESSION,
        workspace: null,
        error: null,
      })

      await deactivateScopedDatabase()
      if (message.deleteLocalData) {
        clearDemoImportPreference()
        await deleteLocalDatabaseForScope(message.scopeKey)
        await deactivateScopedDatabase()
      }
      if (generation !== requestGeneration.current) return
      commitState({ status: 'ready', session: EMPTY_SESSION, workspace: null, error: null })
    },
    [commitState],
  )

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = parseChannelMessage(event.data)
      if (!message) return
      void applyInvalidation(message).catch((cause) => {
        const error = cause instanceof Error ? cause : new Error('Could not update local data')
        commitState({ status: 'ready', session: EMPTY_SESSION, workspace: null, error })
      })
    }
    return () => {
      channel.close()
      if (channelRef.current === channel) channelRef.current = null
    }
  }, [applyInvalidation, commitState])

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
      const { generation, previous } = beginTransition()
      try {
        await operation()
        if (generation !== requestGeneration.current) throw abortError()
        return loadSession(forceWorkspace)
      } catch (cause) {
        if (generation === requestGeneration.current) {
          commitState({ ...previous, status: 'ready', error: cause as Error })
        }
        throw cause
      }
    },
    [beginTransition, commitState, loadSession],
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
    const scopeKey = getActiveDatabaseScope()
    const { generation, previous } = beginTransition()
    try {
      await logoutRequest()
      if (generation !== requestGeneration.current) throw abortError()
      clearDemoImportPreference()
      const message: AuthChannelMessage = {
        type: 'session-invalidated',
        deleteLocalData: false,
        scopeKey,
      }
      channelRef.current?.postMessage(message)
      await deactivateScopedDatabase()
      commitState({ status: 'ready', session: EMPTY_SESSION, workspace: null, error: null })
    } catch (cause) {
      if (generation === requestGeneration.current) {
        commitState({ ...previous, status: 'ready', error: cause as Error })
      }
      throw cause
    }
  }, [beginTransition, commitState])

  const deleteLocalData = useCallback(async () => {
    const scopeKey = getActiveDatabaseScope()
    const { generation, previous } = beginTransition()
    try {
      // A scoped local purge also signs out, avoiding an authenticated cookie
      // pointing at a just-deleted workspace until the next visibility refresh.
      if (previous.session.authenticated) await logoutRequest()
      if (generation !== requestGeneration.current) throw abortError()
      clearDemoImportPreference()
      const message: AuthChannelMessage = {
        type: 'session-invalidated',
        deleteLocalData: true,
        scopeKey,
      }
      channelRef.current?.postMessage(message)
      await deactivateScopedDatabase()
      await deleteLocalDatabaseForScope(scopeKey)
      await deactivateScopedDatabase()
      commitState({ status: 'ready', session: EMPTY_SESSION, workspace: null, error: null })
    } catch (cause) {
      if (generation === requestGeneration.current) {
        commitState({ ...previous, status: 'ready', error: cause as Error })
      }
      throw cause
    }
  }, [beginTransition, commitState])

  const confirmEmail = useCallback(
    (input: ConfirmEmailInput) => refreshAfter(() => confirmEmailRequest(input), false),
    [refreshAfter],
  )

  const deleteAccount = useCallback(
    async (currentPassword: string) => {
      const scopeKey = getActiveDatabaseScope()
      const { generation, previous } = beginTransition()
      try {
        await deleteAccountRequest(currentPassword)
        if (generation !== requestGeneration.current) throw abortError()
        clearDemoImportPreference()
        const message: AuthChannelMessage = {
          type: 'session-invalidated',
          deleteLocalData: true,
          scopeKey,
        }
        channelRef.current?.postMessage(message)
        await deactivateScopedDatabase()
        await deleteLocalDatabaseForScope(scopeKey)
        await deactivateScopedDatabase()
        commitState({ status: 'ready', session: EMPTY_SESSION, workspace: null, error: null })
      } catch (cause) {
        if (generation === requestGeneration.current) {
          commitState({ ...previous, status: 'ready', error: cause as Error })
        }
        throw cause
      }
    },
    [beginTransition, commitState],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refreshSession,
      startDemo,
      register,
      login,
      logout,
      deleteLocalData,
      listAccountSessions: listAccountSessionsRequest,
      revokeAccountSession: revokeAccountSessionRequest,
      revokeOtherAccountSessions: revokeOtherAccountSessionsRequest,
      forgotPassword: forgotPasswordRequest,
      resetPassword: resetPasswordRequest,
      confirmEmail,
      resendConfirmation: resendConfirmationRequest,
      changePassword: changePasswordRequest,
      reauthenticate: reauthenticateRequest,
      exportAccount: exportAccountRequest,
      deleteAccount,
    }),
    [
      state,
      refreshSession,
      startDemo,
      register,
      login,
      logout,
      deleteLocalData,
      confirmEmail,
      deleteAccount,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

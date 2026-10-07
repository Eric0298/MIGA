import Dexie from 'dexie'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, resetApiClientForTests } from '@/lib/api/http'
import { putSnapshot } from '@/lib/api/snapshot-api'
import {
  activateScopedDatabase,
  db,
  deleteAllScopedDatabases,
  getActiveDatabaseName,
  getActiveDatabaseScope,
  LEGACY_DATABASE_NAME,
  MigaDatabase,
} from '@/lib/db/miga-db'
import { clearAllData } from '@/lib/db/import-export'
import { AuthProvider, useAuth } from './AuthProvider'
import { rememberDemoImportPreference } from './demo-import-preference'

const authApi = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/lib/api/auth-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/auth-api')>()),
  getAuthSession: authApi.getAuthSession,
  logout: authApi.logout,
}))

vi.mock('@/lib/api/snapshot-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/snapshot-api')>()),
  getSnapshot: vi.fn(async () => ({
    revision: 0,
    updatedAtUtc: '2026-07-23T10:00:00.000Z',
    data: {
      version: 7,
      exportedAt: 1,
      goals: [],
      sessions: [],
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
      notes: [],
      questions: [],
      examAttempts: [],
    },
  })),
}))

const EMPTY_PAYLOAD = {
  version: 7 as const,
  exportedAt: 1,
  goals: [],
  sessions: [],
  materials: [],
  materialGoalLinks: [],
  materialProgress: [],
  notes: [],
  questions: [],
  examAttempts: [],
}

function StatusProbe() {
  const auth = useAuth()
  return (
    <>
      <span>{auth.status}</span>
      <span data-testid="authenticated">{String(auth.session.authenticated)}</span>
      <span data-testid="requires-login">{String(auth.requiresLogin)}</span>
      <span data-testid="session-expiry">
        {auth.session.authenticated ? auth.session.expiresAtUtc : ''}
      </span>
      <button type="button" onClick={() => void auth.refreshSession()}>
        refresh
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
      <button type="button" onClick={() => void auth.deleteLocalData()}>
        delete-local
      </button>
      <button
        type="button"
        onClick={() => {
          if (!auth.session.authenticated) return
          void putSnapshot(auth.session.workspaceId, 0, EMPTY_PAYLOAD).catch(() => undefined)
        }}
      >
        put-sync
      </button>
      <button type="button" onClick={() => void auth.listAccountSessions().catch(() => undefined)}>
        account-sessions
      </button>
      <button
        type="button"
        onClick={() => void auth.reauthenticate('wrong-password').catch(() => undefined)}
      >
        reauthenticate
      </button>
      <button
        type="button"
        onClick={() => void auth.deleteAccount('wrong-password').catch(() => undefined)}
      >
        delete-account
      </button>
    </>
  )
}

beforeEach(async () => {
  authApi.getAuthSession.mockReset()
  authApi.logout.mockReset()
  authApi.logout.mockResolvedValue(undefined)
  resetApiClientForTests()
  localStorage.clear()
  await deleteAllScopedDatabases()
  await clearAllData()
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await deleteAllScopedDatabases()
  await clearAllData()
})

const AUTHENTICATED_SESSION = {
  authenticated: true as const,
  accountType: 'registered' as const,
  workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'student@example.test',
  expiresAtUtc: '2099-07-24T10:00:00.000Z',
  emailConfirmed: true,
}

describe('AuthProvider local retention', () => {
  it('deactivates without deleting the scoped database when the session is unauthenticated', async () => {
    authApi.getAuthSession.mockResolvedValue({
      authenticated: false,
      accountType: null,
    })
    activateScopedDatabase('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    await db.materialBlobs.put({
      id: '99999999-9999-4999-8999-999999999999',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    const retainedName = getActiveDatabaseName()

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    expect(await screen.findByText('ready')).toBeVisible()
    expect(getActiveDatabaseScope()).toBeNull()
    expect(screen.getByTestId('requires-login')).toHaveTextContent('false')
    expect(await Dexie.exists(retainedName)).toBe(true)
  })

  it('retains scoped blobs on explicit logout', async () => {
    authApi.getAuthSession.mockResolvedValue(AUTHENTICATED_SESSION)
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()
    await db.materialBlobs.put({
      id: '99999999-9999-4999-8999-999999999999',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    const retainedName = getActiveDatabaseName()

    await user.click(screen.getByRole('button', { name: 'logout' }))
    await vi.waitFor(() => expect(getActiveDatabaseScope()).toBeNull())

    expect(authApi.logout).toHaveBeenCalledOnce()
    expect(screen.getByTestId('requires-login')).toHaveTextContent('false')
    expect(await Dexie.exists(retainedName)).toBe(true)
    const retained = new MigaDatabase(retainedName)
    expect(await retained.materialBlobs.count()).toBe(1)
    retained.close()
  })

  it('preserves scoped data and requires login after a 401 refresh', async () => {
    authApi.getAuthSession
      .mockResolvedValueOnce(AUTHENTICATED_SESSION)
      .mockRejectedValueOnce(new ApiError(401, { code: 'session_expired' }))
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()
    await db.materialBlobs.put({
      id: '88888888-8888-4888-8888-888888888888',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    const retainedName = getActiveDatabaseName()

    await user.click(screen.getByRole('button', { name: 'refresh' }))
    await vi.waitFor(() => expect(getActiveDatabaseScope()).toBeNull())

    expect(screen.getByTestId('requires-login')).toHaveTextContent('true')
    expect(await Dexie.exists(retainedName)).toBe(true)
    const retained = new MigaDatabase(retainedName)
    expect(await retained.materialBlobs.count()).toBe(1)
    retained.close()
  })

  it('closes after a sync PUT 401 even if session revalidation loses the network', async () => {
    authApi.getAuthSession
      .mockResolvedValueOnce(AUTHENTICATED_SESSION)
      .mockRejectedValueOnce(new TypeError('Session validation network failure'))
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const path = new URL(String(input)).pathname
        if (path === '/api/auth/csrf') {
          return new Response(JSON.stringify({ requestToken: 'valid-csrf-token-value' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (path === '/api/data/snapshot') {
          return new Response(JSON.stringify({ status: 401, code: 'session_revoked' }), {
            status: 401,
            headers: { 'Content-Type': 'application/problem+json' },
          })
        }
        throw new Error(`Unexpected request: ${path}`)
      }),
    )
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()
    await db.syncMetadata.put({
      id: 'workspace',
      revision: 0,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      dirty: true,
    })
    await db.materialBlobs.put({
      id: '55555555-5555-4555-8555-555555555555',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    const retainedName = getActiveDatabaseName()

    await user.click(screen.getByRole('button', { name: 'put-sync' }))
    await vi.waitFor(() => expect(getActiveDatabaseScope()).toBeNull())

    expect(authApi.getAuthSession).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('requires-login')).toHaveTextContent('true')
    expect(await Dexie.exists(retainedName)).toBe(true)
    const retained = new MigaDatabase(retainedName)
    expect(await retained.syncMetadata.get('workspace')).toMatchObject({ dirty: true })
    expect(await retained.materialBlobs.count()).toBe(1)
    retained.close()
  })

  it('keeps a valid session active after an account 403 requires reauthentication', async () => {
    authApi.getAuthSession.mockResolvedValue(AUTHENTICATED_SESSION)
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ status: 403, code: 'reauthentication_required' }), {
          status: 403,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    )
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()
    const retainedScope = getActiveDatabaseScope()
    const retainedName = getActiveDatabaseName()

    await user.click(screen.getByRole('button', { name: 'account-sessions' }))
    await vi.waitFor(() => expect(authApi.getAuthSession).toHaveBeenCalledTimes(2))

    expect(getActiveDatabaseScope()).toBe(retainedScope)
    expect(getActiveDatabaseName()).toBe(retainedName)
    expect(screen.getByText('ready')).toBeVisible()
  })

  it('keeps the scope after invalid reauthentication credentials and failed session validation', async () => {
    authApi.getAuthSession
      .mockResolvedValueOnce(AUTHENTICATED_SESSION)
      .mockRejectedValueOnce(new TypeError('Session validation network failure'))
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const path = new URL(String(input)).pathname
        if (path === '/api/auth/csrf') {
          return new Response(JSON.stringify({ requestToken: 'valid-csrf-token-value' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (path === '/api/auth/reauthenticate') {
          return new Response(JSON.stringify({ status: 401, code: 'invalid_credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/problem+json' },
          })
        }
        throw new Error(`Unexpected request: ${path}`)
      }),
    )
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()
    const retainedScope = getActiveDatabaseScope()
    const retainedName = getActiveDatabaseName()

    await user.click(screen.getByRole('button', { name: 'reauthenticate' }))
    await vi.waitFor(() => expect(authApi.getAuthSession).toHaveBeenCalledTimes(2))

    expect(getActiveDatabaseScope()).toBe(retainedScope)
    expect(getActiveDatabaseName()).toBe(retainedName)
    expect(screen.getByText('ready')).toBeVisible()
  })

  it('does not restore-or-close incorrectly after invalid /api/account credentials', async () => {
    authApi.getAuthSession
      .mockResolvedValueOnce(AUTHENTICATED_SESSION)
      .mockRejectedValueOnce(new TypeError('Session validation network failure'))
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const path = new URL(String(input)).pathname
        if (path === '/api/auth/csrf') {
          return new Response(JSON.stringify({ requestToken: 'valid-csrf-token-value' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (path === '/api/account') {
          return new Response(JSON.stringify({ status: 401, code: 'invalid_credentials' }), {
            status: 401,
            headers: { 'Content-Type': 'application/problem+json' },
          })
        }
        throw new Error(`Unexpected request: ${path}`)
      }),
    )
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()
    const retainedScope = getActiveDatabaseScope()
    const retainedName = getActiveDatabaseName()

    await user.click(screen.getByRole('button', { name: 'delete-account' }))
    await vi.waitFor(() => expect(authApi.getAuthSession).toHaveBeenCalledTimes(2))

    expect(getActiveDatabaseScope()).toBe(retainedScope)
    expect(getActiveDatabaseName()).toBe(retainedName)
    expect(screen.getByText('ready')).toBeVisible()
  })

  it('handles a revoked exact /api/account request without restoring stale auth state', async () => {
    authApi.getAuthSession
      .mockResolvedValueOnce(AUTHENTICATED_SESSION)
      .mockResolvedValueOnce({ authenticated: false, accountType: null })
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const path = new URL(String(input)).pathname
        if (path === '/api/auth/csrf') {
          return new Response(JSON.stringify({ requestToken: 'valid-csrf-token-value' }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }
        if (path === '/api/account') {
          return new Response(JSON.stringify({ status: 401, code: 'session_revoked' }), {
            status: 401,
            headers: { 'Content-Type': 'application/problem+json' },
          })
        }
        throw new Error(`Unexpected request: ${path}`)
      }),
    )
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()
    const retainedName = getActiveDatabaseName()

    await user.click(screen.getByRole('button', { name: 'delete-account' }))
    await vi.waitFor(() => expect(getActiveDatabaseScope()).toBeNull())

    expect(authApi.getAuthSession).toHaveBeenCalledTimes(2)
    expect(await Dexie.exists(retainedName)).toBe(true)
    expect(screen.getByText('ready')).toBeVisible()
  })

  it('opens the legacy local workspace when the initial session request has a network failure', async () => {
    authApi.getAuthSession.mockRejectedValue(new TypeError('Network unavailable'))
    await db.goals.put({
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Legacy local',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 1,
    })

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    expect(await screen.findByText('ready')).toBeVisible()
    expect(getActiveDatabaseName()).toBe(LEGACY_DATABASE_NAME)
    expect(await db.goals.count()).toBe(1)
    expect(screen.getByTestId('requires-login')).toHaveTextContent('false')
  })

  it('requires login after losing an authenticated workspace and clears it on recovery', async () => {
    authApi.getAuthSession
      .mockResolvedValueOnce(AUTHENTICATED_SESSION)
      .mockResolvedValueOnce({ authenticated: false, accountType: null })
      .mockResolvedValueOnce({ authenticated: false, accountType: null })
      .mockResolvedValueOnce(AUTHENTICATED_SESSION)
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'refresh' }))
    await vi.waitFor(() => expect(screen.getByTestId('requires-login')).toHaveTextContent('true'))
    await user.click(screen.getByRole('button', { name: 'refresh' }))
    expect(screen.getByTestId('requires-login')).toHaveTextContent('true')
    await user.click(screen.getByRole('button', { name: 'refresh' }))
    await vi.waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'))
    expect(screen.getByTestId('requires-login')).toHaveTextContent('false')
  })

  it('deletes only after the explicit local-data action and signs out first', async () => {
    authApi.getAuthSession.mockResolvedValue(AUTHENTICATED_SESSION)
    const user = userEvent.setup()
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    expect(await screen.findByText('ready')).toBeVisible()
    await db.materialBlobs.put({
      id: '66666666-6666-4666-8666-666666666666',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    const deletedName = getActiveDatabaseName()
    rememberDemoImportPreference(AUTHENTICATED_SESSION.workspaceId, true)
    expect(localStorage.length).toBe(1)

    await user.click(screen.getByRole('button', { name: 'delete-local' }))
    await vi.waitFor(() => expect(getActiveDatabaseScope()).toBeNull())

    expect(authApi.logout).toHaveBeenCalledOnce()
    expect(await Dexie.exists(deletedName)).toBe(false)
    expect(getActiveDatabaseName()).toBe(LEGACY_DATABASE_NAME)
    expect(localStorage.length).toBe(0)
  })
})

describe('AuthProvider idle deadline renewal', () => {
  const START = Date.parse('2026-10-07T10:00:00.000Z')
  const IDLE_TIMEOUT_MS = 30 * 60_000
  const LEAD_MS = 60_000

  async function renderWithDeadline() {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(START)
    const rendered = render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )
    await vi.waitFor(() => expect(screen.getByText('ready')).toBeVisible())
    return rendered
  }

  function sessionAt(expiresAt: number) {
    return { ...AUTHENTICATED_SESSION, expiresAtUtc: new Date(expiresAt).toISOString() }
  }

  async function advanceTo(time: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(time - Date.now())
    })
  }

  it('renews repeatedly before the idle deadline while preserving the study timer', async () => {
    const firstExpiry = START + IDLE_TIMEOUT_MS
    const secondExpiry = firstExpiry - LEAD_MS + IDLE_TIMEOUT_MS
    authApi.getAuthSession
      .mockResolvedValueOnce(sessionAt(firstExpiry))
      .mockResolvedValueOnce(sessionAt(secondExpiry))
      .mockResolvedValueOnce(sessionAt(secondExpiry - LEAD_MS + IDLE_TIMEOUT_MS))
    await renderWithDeadline()
    const scopeKey = getActiveDatabaseScope()
    const studySession = {
      id: '99999999-9999-4999-8999-999999999999',
      goalId: null,
      materialIds: [],
      startedAt: START,
      pausedAt: null,
      endedAt: null,
      totalPausedMs: 0,
      status: 'running' as const,
      createdAt: START,
      updatedAt: START,
    }
    await db.sessions.put(studySession)

    await advanceTo(firstExpiry - LEAD_MS - 1)
    expect(authApi.getAuthSession).toHaveBeenCalledOnce()
    await advanceTo(firstExpiry - LEAD_MS)
    await vi.waitFor(() =>
      expect(screen.getByTestId('session-expiry')).toHaveTextContent(
        new Date(secondExpiry).toISOString(),
      ),
    )
    await advanceTo(secondExpiry - LEAD_MS)
    await vi.waitFor(() =>
      expect(screen.getByTestId('session-expiry')).toHaveTextContent(
        new Date(secondExpiry - LEAD_MS + IDLE_TIMEOUT_MS).toISOString(),
      ),
    )
    expect(authApi.getAuthSession).toHaveBeenCalledTimes(3)

    expect(getActiveDatabaseScope()).toBe(scopeKey)
    expect(await db.sessions.get(studySession.id)).toEqual(studySession)
    expect(screen.getByTestId('requires-login')).toHaveTextContent('false')
  })

  it('keeps a running study session authenticated while the tab is hidden', async () => {
    const firstExpiry = START + IDLE_TIMEOUT_MS
    authApi.getAuthSession
      .mockResolvedValueOnce(sessionAt(firstExpiry))
      .mockResolvedValueOnce(sessionAt(firstExpiry - LEAD_MS + IDLE_TIMEOUT_MS))
    await renderWithDeadline()
    await db.sessions.put({
      id: '88888888-8888-4888-8888-888888888888',
      goalId: null,
      materialIds: [],
      startedAt: START,
      pausedAt: null,
      endedAt: null,
      totalPausedMs: 0,
      status: 'running',
      createdAt: START,
      updatedAt: START,
    })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    await advanceTo(firstExpiry - LEAD_MS)
    await vi.waitFor(() =>
      expect(screen.getByTestId('session-expiry')).toHaveTextContent(
        new Date(firstExpiry - LEAD_MS + IDLE_TIMEOUT_MS).toISOString(),
      ),
    )
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
  })

  it('lets an inactive hidden account expire and requires login when it becomes visible', async () => {
    const firstExpiry = START + IDLE_TIMEOUT_MS
    authApi.getAuthSession
      .mockResolvedValueOnce(sessionAt(firstExpiry))
      .mockResolvedValueOnce({ authenticated: false, accountType: null })
    await renderWithDeadline()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    await advanceTo(firstExpiry + 5_000)
    expect(authApi.getAuthSession).toHaveBeenCalledOnce()
    visibility.mockReturnValue('visible')
    await act(async () => fireEvent(document, new Event('visibilitychange')))
    await vi.waitFor(() => expect(screen.getByTestId('requires-login')).toHaveTextContent('true'))
    expect(getActiveDatabaseScope()).toBeNull()
  })

  it('does not renew a paused study session while the tab is hidden', async () => {
    const firstExpiry = START + IDLE_TIMEOUT_MS
    authApi.getAuthSession.mockResolvedValue(sessionAt(firstExpiry))
    await renderWithDeadline()
    await db.sessions.put({
      id: '77777777-7777-4777-8777-777777777777',
      goalId: null,
      materialIds: [],
      startedAt: START,
      pausedAt: START + 1_000,
      endedAt: null,
      totalPausedMs: 0,
      status: 'paused',
      createdAt: START,
      updatedAt: START + 1_000,
    })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    await advanceTo(firstExpiry + 5_000)

    expect(authApi.getAuthSession).toHaveBeenCalledOnce()
  })

  it('validates an unchanged absolute deadline once and preserves expiry enforcement', async () => {
    const absoluteExpiry = START + IDLE_TIMEOUT_MS
    authApi.getAuthSession
      .mockResolvedValueOnce(sessionAt(absoluteExpiry))
      .mockResolvedValueOnce(sessionAt(absoluteExpiry))
      .mockResolvedValueOnce({ authenticated: false, accountType: null })
    await renderWithDeadline()

    await advanceTo(absoluteExpiry - LEAD_MS)
    await vi.waitFor(() => expect(authApi.getAuthSession).toHaveBeenCalledTimes(2))
    await advanceTo(absoluteExpiry - 1)
    expect(authApi.getAuthSession).toHaveBeenCalledTimes(2)
    await advanceTo(absoluteExpiry + 1_000)
    await vi.waitFor(() => expect(screen.getByTestId('requires-login')).toHaveTextContent('true'))
    await advanceTo(absoluteExpiry + 5 * 60_000)
    expect(authApi.getAuthSession).toHaveBeenCalledTimes(3)
  })

  it('recovers a brief network failure before the idle deadline', async () => {
    const firstExpiry = START + IDLE_TIMEOUT_MS
    const recoveredExpiry = firstExpiry - LEAD_MS + 5_000 + IDLE_TIMEOUT_MS
    authApi.getAuthSession
      .mockResolvedValueOnce(sessionAt(firstExpiry))
      .mockRejectedValueOnce(new TypeError('Temporary network failure'))
      .mockResolvedValueOnce(sessionAt(recoveredExpiry))
    await renderWithDeadline()
    const scopeKey = getActiveDatabaseScope()

    await advanceTo(firstExpiry - LEAD_MS)
    await vi.waitFor(() => expect(authApi.getAuthSession).toHaveBeenCalledTimes(2))
    await advanceTo(firstExpiry - LEAD_MS + 5_000)
    await vi.waitFor(() =>
      expect(screen.getByTestId('session-expiry')).toHaveTextContent(
        new Date(recoveredExpiry).toISOString(),
      ),
    )
    await advanceTo(firstExpiry + 5_000)

    expect(authApi.getAuthSession).toHaveBeenCalledTimes(3)
    expect(getActiveDatabaseScope()).toBe(scopeKey)
    expect(screen.getByTestId('requires-login')).toHaveTextContent('false')
  })

  it('retains local work on transient renewal failures without polling after expiry', async () => {
    const firstExpiry = START + IDLE_TIMEOUT_MS
    authApi.getAuthSession
      .mockResolvedValueOnce(sessionAt(firstExpiry))
      .mockRejectedValue(new TypeError('Network unavailable'))
    await renderWithDeadline()
    const scopeKey = getActiveDatabaseScope()

    await advanceTo(firstExpiry - LEAD_MS)
    await vi.waitFor(() => expect(authApi.getAuthSession).toHaveBeenCalledTimes(2))
    await advanceTo(firstExpiry - LEAD_MS + 5_000)
    await vi.waitFor(() => expect(authApi.getAuthSession).toHaveBeenCalledTimes(3))
    await advanceTo(firstExpiry + 1_000)
    await advanceTo(firstExpiry + 5_000)
    const attemptsAtExpiry = authApi.getAuthSession.mock.calls.length
    expect(attemptsAtExpiry).toBeGreaterThan(3)
    await advanceTo(firstExpiry + 5 * 60_000)

    expect(authApi.getAuthSession).toHaveBeenCalledTimes(attemptsAtExpiry)
    expect(getActiveDatabaseScope()).toBe(scopeKey)
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    expect(screen.getByTestId('requires-login')).toHaveTextContent('false')
  })
})

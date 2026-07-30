import { randomUUID } from 'node:crypto'
import type { Page, Route } from '@playwright/test'

type AccountFixture = {
  email: string
  password: string
  workspaceId?: string
  userId?: string
  emailConfirmed?: boolean
}

type Account = Required<AccountFixture>

type PendingRegistration = {
  email: string
  userId: string
  demoWorkspaceId: string | null
}

type SessionActor =
  { kind: 'demo'; workspaceId: string } | { kind: 'registered'; account: Account } | null

type SnapshotState = {
  revision: number
  updatedAtUtc: string
  data: unknown
}

type SessionFailure = 'network' | '401' | null

const EMPTY_SNAPSHOT = () => ({
  version: 7,
  exportedAt: Date.now(),
  goals: [],
  sessions: [],
  materials: [],
  materialGoalLinks: [],
  materialProgress: [],
  notes: [],
  questions: [],
  examAttempts: [],
})

function accountFromFixture(fixture: AccountFixture): Account {
  return {
    email: fixture.email,
    password: fixture.password,
    workspaceId: fixture.workspaceId ?? randomUUID(),
    userId: fixture.userId ?? randomUUID(),
    emailConfirmed: fixture.emailConfirmed ?? true,
  }
}

async function problem(route: Route, status: number, code: string): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/problem+json',
    body: JSON.stringify({ status, code }),
  })
}

export type StatefulAuthApi = {
  setSessionFailure: (failure: SessionFailure) => void
  useAccount: (email: string | null) => void
  getCurrentWorkspaceId: () => string | null
  getPendingUserId: () => string | null
  getPutBodies: () => Array<{ workspaceId: string; revision: number; data: unknown }>
  failNextSnapshotPutWithRevokedSession: () => void
  account: (email: string) => Account
}

export async function installStatefulAuthApi(
  page: Page,
  fixtures: AccountFixture[] = [],
): Promise<StatefulAuthApi> {
  const accounts = new Map(
    fixtures.map((fixture) => {
      const account = accountFromFixture(fixture)
      return [account.email, account]
    }),
  )
  const snapshots = new Map<string, SnapshotState>()
  for (const account of accounts.values()) {
    snapshots.set(account.workspaceId, {
      revision: 0,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      data: EMPTY_SNAPSHOT(),
    })
  }

  let actor: SessionActor = null
  let pending: PendingRegistration | null = null
  let sessionFailure: SessionFailure = null
  let revokeOnNextSnapshotPut = false
  const putBodies: Array<{ workspaceId: string; revision: number; data: unknown }> = []

  const currentWorkspaceId = () => {
    if (!actor) return null
    return actor.kind === 'demo' ? actor.workspaceId : actor.account.workspaceId
  }

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()

    if (url.pathname === '/api/auth/session' && method === 'GET') {
      if (sessionFailure === 'network') {
        await route.abort('failed')
        return
      }
      if (sessionFailure === '401') {
        await problem(route, 401, 'session_expired')
        return
      }
      if (!actor) {
        await route.fulfill({ json: { authenticated: false, accountType: null } })
        return
      }
      if (actor.kind === 'demo') {
        await route.fulfill({
          json: {
            authenticated: true,
            accountType: 'demo',
            workspaceId: actor.workspaceId,
            userId: null,
            email: null,
            expiresAtUtc: '2099-07-24T10:00:00.000Z',
            emailConfirmed: true,
          },
        })
        return
      }
      await route.fulfill({
        json: {
          authenticated: true,
          accountType: 'registered',
          workspaceId: actor.account.workspaceId,
          userId: actor.account.userId,
          email: actor.account.email,
          expiresAtUtc: '2099-07-24T10:00:00.000Z',
          emailConfirmed: actor.account.emailConfirmed,
        },
      })
      return
    }

    if (url.pathname === '/api/auth/csrf' && method === 'GET') {
      await route.fulfill({ json: { requestToken: 'stateful-e2e-csrf-token' } })
      return
    }

    if (url.pathname === '/api/auth/demo' && method === 'POST') {
      const workspaceId = randomUUID()
      snapshots.set(workspaceId, {
        revision: 0,
        updatedAtUtc: new Date().toISOString(),
        data: EMPTY_SNAPSHOT(),
      })
      actor = { kind: 'demo', workspaceId }
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (url.pathname === '/api/auth/register' && method === 'POST') {
      const body = request.postDataJSON() as {
        email: string
        importDemoData: boolean
      }
      pending = {
        email: body.email,
        userId: randomUUID(),
        demoWorkspaceId: actor?.kind === 'demo' ? actor.workspaceId : null,
      }
      await route.fulfill({ status: 202, body: '' })
      return
    }

    if (url.pathname === '/api/auth/confirm-email' && method === 'POST') {
      const body = request.postDataJSON() as {
        userId: string
        newPassword: string
        privacyPolicyVersion: string
        importDemoData: boolean
        continueWithoutDemoData: boolean
      }
      if (
        !pending ||
        pending.userId !== body.userId ||
        body.privacyPolicyVersion !== '2026-07-23' ||
        (body.importDemoData && body.continueWithoutDemoData)
      ) {
        await problem(route, 400, 'confirmation_invalid')
        return
      }
      if (
        body.importDemoData &&
        (actor?.kind !== 'demo' ||
          pending.demoWorkspaceId === null ||
          actor.workspaceId !== pending.demoWorkspaceId)
      ) {
        await problem(route, 409, 'demo_conversion_unavailable')
        return
      }
      const workspaceId =
        body.importDemoData && pending.demoWorkspaceId ? pending.demoWorkspaceId : randomUUID()
      if (!snapshots.has(workspaceId)) {
        snapshots.set(workspaceId, {
          revision: 0,
          updatedAtUtc: new Date().toISOString(),
          data: EMPTY_SNAPSHOT(),
        })
      }
      const account: Account = {
        email: pending.email,
        password: body.newPassword,
        workspaceId,
        userId: pending.userId,
        emailConfirmed: true,
      }
      accounts.set(account.email, account)
      actor = { kind: 'registered', account }
      pending = null
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (url.pathname === '/api/auth/login' && method === 'POST') {
      const body = request.postDataJSON() as { email: string; password: string }
      const account = accounts.get(body.email)
      if (!account || account.password !== body.password) {
        await problem(route, 401, 'invalid_credentials')
        return
      }
      actor = { kind: 'registered', account }
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (url.pathname === '/api/auth/logout' && method === 'POST') {
      actor = null
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (url.pathname === '/api/auth/reauthenticate' && method === 'POST') {
      await route.fulfill({ status: actor?.kind === 'registered' ? 204 : 401, body: '' })
      return
    }

    if (
      (url.pathname === '/api/auth/resend-confirmation' ||
        url.pathname === '/api/auth/change-password') &&
      method === 'POST'
    ) {
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (url.pathname === '/api/data/snapshot' && method === 'GET') {
      const workspaceId = currentWorkspaceId()
      if (!workspaceId) {
        await problem(route, 401, 'session_required')
        return
      }
      await route.fulfill({ json: snapshots.get(workspaceId) })
      return
    }

    if (url.pathname === '/api/data/snapshot' && method === 'PUT') {
      if (revokeOnNextSnapshotPut) {
        revokeOnNextSnapshotPut = false
        actor = null
        await problem(route, 401, 'session_revoked')
        return
      }
      const workspaceId = currentWorkspaceId()
      const body = request.postDataJSON() as {
        workspaceId: string
        revision: number
        data: unknown
      }
      if (!workspaceId || body.workspaceId !== workspaceId) {
        await problem(route, 403, 'workspace_mismatch')
        return
      }
      const snapshot = snapshots.get(workspaceId)!
      if (body.revision !== snapshot.revision) {
        await problem(route, 409, 'revision_conflict')
        return
      }
      putBodies.push(body)
      const saved = {
        revision: snapshot.revision + 1,
        updatedAtUtc: new Date().toISOString(),
        data: body.data,
      }
      snapshots.set(workspaceId, saved)
      await route.fulfill({ json: saved })
      return
    }

    if (url.pathname === '/api/account/sessions' && method === 'GET') {
      await route.fulfill({
        json:
          actor?.kind === 'registered'
            ? [
                {
                  sessionId: randomUUID(),
                  createdAtUtc: '2026-07-23T10:00:00.000Z',
                  lastSeenAtUtc: '2026-07-23T11:00:00.000Z',
                  expiresAtUtc: '2099-07-24T10:00:00.000Z',
                  current: true,
                },
              ]
            : [],
      })
      return
    }

    if (url.pathname.startsWith('/api/account/sessions') && method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
      return
    }

    if (url.pathname === '/api/account' && method === 'DELETE') {
      if (actor?.kind === 'registered') {
        snapshots.delete(actor.account.workspaceId)
        accounts.delete(actor.account.email)
      }
      actor = null
      await route.fulfill({ status: 204, body: '' })
      return
    }

    await route.fulfill({ status: 204, body: '' })
  })

  await page.addInitScript(() => {
    window.localStorage.setItem('miga.language', 'es')
  })

  return {
    setSessionFailure: (failure) => {
      sessionFailure = failure
    },
    useAccount: (email) => {
      actor = email === null ? null : { kind: 'registered', account: accounts.get(email)! }
    },
    getCurrentWorkspaceId: currentWorkspaceId,
    getPendingUserId: () => pending?.userId ?? null,
    getPutBodies: () => [...putBodies],
    failNextSnapshotPutWithRevokedSession: () => {
      revokeOnNextSnapshotPut = true
    },
    account: (email) => accounts.get(email)!,
  }
}

export async function activeDatabaseName(page: Page): Promise<string> {
  return page.evaluate(async () => {
    // @ts-expect-error Browser-only Vite module loaded inside page.evaluate.
    const { db } = await import(/* @vite-ignore */ '/src/lib/db/miga-db.ts')
    return db.name
  })
}

export async function seedActiveGoal(page: Page, name: string): Promise<string> {
  return page.evaluate(async (goalName) => {
    // @ts-expect-error Browser-only Vite module loaded inside page.evaluate.
    const { db } = await import(/* @vite-ignore */ '/src/lib/db/miga-db.ts')
    const id = crypto.randomUUID()
    const now = Date.now()
    const today = new Date()
    const day =
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-` +
      String(today.getDate()).padStart(2, '0')
    await db.goals.put({
      id,
      name: goalName,
      targetMinutes: 60,
      scheduledDays: [day],
      createdAt: now,
      updatedAt: now,
    })
    return id
  }, name)
}

export async function seedActiveBlob(page: Page): Promise<string> {
  return page.evaluate(async () => {
    // @ts-expect-error Browser-only Vite module loaded inside page.evaluate.
    const { db } = await import(/* @vite-ignore */ '/src/lib/db/miga-db.ts')
    const id = crypto.randomUUID()
    const blob = new Blob(['local-only'], { type: 'application/pdf' })
    await db.materialBlobs.put({
      id,
      materialId: null,
      mimeType: blob.type,
      size: blob.size,
      blob,
      createdAt: Date.now(),
    })
    return id
  })
}

export async function readDatabase(
  page: Page,
  databaseName?: string,
): Promise<{ goals: string[]; blobs: number }> {
  return page.evaluate(async (name) => {
    // @ts-expect-error Browser-only Vite module loaded inside page.evaluate.
    const module = await import(/* @vite-ignore */ '/src/lib/db/miga-db.ts')
    const database = name && module.db.name !== name ? new module.MigaDatabase(name) : module.db
    try {
      return {
        goals: (await database.goals.toArray()).map((goal: { name: string }) => goal.name),
        blobs: await database.materialBlobs.count(),
      }
    } finally {
      if (database !== module.db) database.close()
    }
  }, databaseName)
}

export async function readDatabaseDirty(page: Page, databaseName: string): Promise<boolean | null> {
  return page.evaluate(async (name) => {
    // @ts-expect-error Browser-only Vite module loaded inside page.evaluate.
    const { MigaDatabase } = await import(/* @vite-ignore */ '/src/lib/db/miga-db.ts')
    const database = new MigaDatabase(name)
    try {
      return (await database.syncMetadata.get('workspace'))?.dirty ?? null
    } finally {
      database.close()
    }
  }, databaseName)
}

export async function databaseExists(page: Page, databaseName: string): Promise<boolean> {
  return page.evaluate(async (name) => {
    const databases = await indexedDB.databases()
    return databases.some((database) => database.name === name)
  }, databaseName)
}

import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  db,
  deleteAllScopedDatabases,
  getActiveDatabaseName,
  LEGACY_DATABASE_NAME,
} from '@/lib/db/miga-db'
import { bootstrapAuthenticatedWorkspace, scopeKeyForSession } from './workspace-bootstrap'

const snapshotState = vi.hoisted(() => ({
  revision: 0,
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
  } as unknown,
}))

vi.mock('@/lib/api/snapshot-api', () => ({
  getSnapshot: vi.fn(async () => ({
    revision: snapshotState.revision,
    updatedAtUtc: '2026-07-23T10:00:00.000Z',
    data: snapshotState.data,
  })),
}))

afterEach(async () => {
  snapshotState.revision = 0
  snapshotState.data = {
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
  }
  await deleteAllScopedDatabases()
})

describe('workspace bootstrap scoping', () => {
  it('keeps the same scope when a demo expiry is extended', async () => {
    const base = {
      authenticated: true as const,
      accountType: 'demo' as const,
      workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: '11111111-1111-4111-8111-111111111111',
      email: null,
      emailConfirmed: true,
    }
    const first = await scopeKeyForSession({
      ...base,
      expiresAtUtc: '2026-07-24T10:00:00.000Z',
    })
    const extended = await scopeKeyForSession({
      ...base,
      expiresAtUtc: '2026-07-24T10:02:00.000Z',
    })
    expect(extended).toBe(first)
  })

  it('keeps the same scope when a demo workspace is converted to a registered account', async () => {
    const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const demoScope = await scopeKeyForSession({
      authenticated: true,
      accountType: 'demo',
      workspaceId,
      userId: null,
      email: null,
      expiresAtUtc: '2026-07-24T10:00:00.000Z',
      emailConfirmed: true,
    })
    const registeredScope = await scopeKeyForSession({
      authenticated: true,
      accountType: 'registered',
      workspaceId,
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'student@example.test',
      expiresAtUtc: '2026-07-24T10:00:00.000Z',
      emailConfirmed: true,
    })

    expect(registeredScope).toBe(demoScope)
  })

  it('preserves but does not expose the prior identity database when activating another', async () => {
    await bootstrapAuthenticatedWorkspace({
      authenticated: true,
      accountType: 'demo',
      workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: '11111111-1111-4111-8111-111111111111',
      email: null,
      expiresAtUtc: '2026-07-24T10:00:00.000Z',
      emailConfirmed: true,
    })
    const firstName = getActiveDatabaseName()
    expect(firstName).not.toBe(LEGACY_DATABASE_NAME)
    await db.materialBlobs.put({
      id: '99999999-9999-4999-8999-999999999999',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })

    await bootstrapAuthenticatedWorkspace({
      authenticated: true,
      accountType: 'registered',
      workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId: '22222222-2222-4222-8222-222222222222',
      email: 'student@example.test',
      expiresAtUtc: '2026-07-24T10:00:00.000Z',
      emailConfirmed: true,
    })

    expect(getActiveDatabaseName()).not.toBe(firstName)
    expect(await Dexie.exists(firstName)).toBe(true)
    expect(await db.materialBlobs.count()).toBe(0)
    expect((await Dexie.getDatabaseNames()).includes(LEGACY_DATABASE_NAME)).toBe(false)
  })

  it('preserves device-local blobs and running session state during a same-scope pull', async () => {
    const materialId = '33333333-3333-4333-8333-333333333333'
    const blobId = '44444444-4444-4444-8444-444444444444'
    const sessionId = '55555555-5555-4555-8555-555555555555'
    snapshotState.data = {
      version: 7,
      exportedAt: 1,
      goals: [],
      sessions: [
        {
          id: sessionId,
          goalId: null,
          materialIds: [materialId],
          startedAt: 1,
          pausedAt: null,
          endedAt: null,
          totalPausedMs: 0,
          status: 'running',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      materials: [
        {
          id: materialId,
          kind: 'pdf',
          title: 'Local PDF',
          fileBlobKey: blobId,
          metadata: { mimeType: 'application/pdf', fileSizeBytes: 4 },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      materialGoalLinks: [],
      materialProgress: [],
      notes: [],
      questions: [],
      examAttempts: [],
    }
    const session = {
      authenticated: true as const,
      accountType: 'registered' as const,
      workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId: '22222222-2222-4222-8222-222222222222',
      email: 'student@example.test',
      expiresAtUtc: '2026-07-24T10:00:00.000Z',
      emailConfirmed: true,
    }

    await bootstrapAuthenticatedWorkspace(session)
    await db.materialBlobs.put({
      id: blobId,
      materialId,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    await bootstrapAuthenticatedWorkspace(session)

    expect(await db.materialBlobs.get(blobId)).toBeDefined()
    expect((await db.sessions.get(sessionId))?.status).toBe('running')
  })

  it('does not overwrite durable dirty local data on reload and surfaces revision conflict', async () => {
    const session = {
      authenticated: true as const,
      accountType: 'registered' as const,
      workspaceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      userId: '66666666-6666-4666-8666-666666666666',
      email: 'offline@example.test',
      expiresAtUtc: '2026-07-24T10:00:00.000Z',
      emailConfirmed: true,
    }
    await bootstrapAuthenticatedWorkspace(session)
    const localGoalId = '77777777-7777-4777-8777-777777777777'
    await db.goals.put({
      id: localGoalId,
      name: 'Unsynced local goal',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 2,
      updatedAt: 2,
    })
    await db.syncMetadata.put({
      id: 'workspace',
      revision: 0,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      dirty: true,
    })

    const pending = await bootstrapAuthenticatedWorkspace(session)
    expect(pending.initialSyncStatus).toBe('pending')
    expect(await db.goals.get(localGoalId)).toBeDefined()

    snapshotState.revision = 1
    const conflicted = await bootstrapAuthenticatedWorkspace(session)
    expect(conflicted.initialSyncStatus).toBe('conflict')
    expect(await db.goals.get(localGoalId)).toBeDefined()
  })
})

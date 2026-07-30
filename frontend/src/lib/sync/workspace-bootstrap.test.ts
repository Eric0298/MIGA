import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  activateScopedDatabase,
  db,
  deleteAllScopedDatabases,
  getActiveDatabaseName,
  LEGACY_DATABASE_NAME,
  MigaDatabase,
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
  queue: [] as Array<{ revision: number; updatedAtUtc: string; data: unknown }>,
}))

vi.mock('@/lib/api/snapshot-api', () => ({
  getSnapshot: vi.fn(async () => {
    const queued = snapshotState.queue.shift()
    return (
      queued ?? {
        revision: snapshotState.revision,
        updatedAtUtc: '2026-07-23T10:00:00.000Z',
        data: snapshotState.data,
      }
    )
  }),
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
  snapshotState.queue = []
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

  it('serializes different identities and writes each snapshot only to its captured database', async () => {
    const goalA = {
      id: 'aaaaaaaa-1111-4111-8111-111111111111',
      name: 'Workspace A',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 1,
    }
    const goalB = {
      ...goalA,
      id: 'bbbbbbbb-2222-4222-8222-222222222222',
      name: 'Workspace B',
    }
    const payload = (goal: typeof goalA) => ({
      version: 7,
      exportedAt: 1,
      goals: [goal],
      sessions: [],
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
      notes: [],
      questions: [],
      examAttempts: [],
    })
    snapshotState.queue = [
      {
        revision: 1,
        updatedAtUtc: '2026-07-23T10:00:00.000Z',
        data: payload(goalA),
      },
      {
        revision: 2,
        updatedAtUtc: '2026-07-23T11:00:00.000Z',
        data: payload(goalB),
      },
    ]
    const sessionA = {
      authenticated: true as const,
      accountType: 'registered' as const,
      workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'a@example.test',
      emailConfirmed: true,
    }
    const sessionB = {
      ...sessionA,
      workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      userId: '22222222-2222-4222-8222-222222222222',
      email: 'b@example.test',
    }

    const [first, second] = await Promise.all([
      bootstrapAuthenticatedWorkspace(sessionA),
      bootstrapAuthenticatedWorkspace(sessionB),
    ])

    const firstReader = new MigaDatabase(first.database.name)
    expect((await firstReader.goals.toArray()).map((goal) => goal.id)).toEqual([goalA.id])
    expect((await second.database.goals.toArray()).map((goal) => goal.id)).toEqual([goalB.id])
    expect(first.database.name).not.toBe(second.database.name)
    firstReader.close()
  })

  it('preserves local data without metadata when the remote snapshot is empty', async () => {
    const session = {
      authenticated: true as const,
      accountType: 'registered' as const,
      workspaceId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      userId: '44444444-4444-4444-8444-444444444444',
      email: 'local@example.test',
      emailConfirmed: true,
    }
    activateScopedDatabase(await scopeKeyForSession(session))
    const localGoalId = 'dddddddd-1111-4111-8111-111111111111'
    await db.goals.put({
      id: localGoalId,
      name: 'Local only',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 1,
    })

    const bootstrapped = await bootstrapAuthenticatedWorkspace(session)

    expect(bootstrapped.initialSyncStatus).toBe('pending')
    expect(await bootstrapped.database.goals.get(localGoalId)).toBeDefined()
    expect((await bootstrapped.database.syncMetadata.get('workspace'))?.dirty).toBe(true)
  })

  it('preserves local data when the remote revision is older', async () => {
    const session = {
      authenticated: true as const,
      accountType: 'registered' as const,
      workspaceId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      userId: '55555555-5555-4555-8555-555555555555',
      email: 'old@example.test',
      emailConfirmed: true,
    }
    snapshotState.revision = 5
    const first = await bootstrapAuthenticatedWorkspace(session)
    const localGoalId = 'eeeeeeee-1111-4111-8111-111111111111'
    await first.database.goals.put({
      id: localGoalId,
      name: 'Newer local',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 2,
    })
    snapshotState.revision = 4

    const bootstrapped = await bootstrapAuthenticatedWorkspace(session)

    expect(bootstrapped.initialSyncStatus).toBe('conflict')
    expect(await bootstrapped.database.goals.get(localGoalId)).toBeDefined()
  })

  it('preserves an unmarked local mutation when a newer remote snapshot arrives', async () => {
    const originalGoal = {
      id: 'ffffffff-1111-4111-8111-111111111111',
      name: 'Original',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 1,
    }
    snapshotState.data = {
      version: 7,
      exportedAt: 1,
      goals: [originalGoal],
      sessions: [],
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
      notes: [],
      questions: [],
      examAttempts: [],
    }
    const session = {
      authenticated: true as const,
      accountType: 'registered' as const,
      workspaceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      userId: '66666666-1111-4111-8111-111111111111',
      email: 'diverged@example.test',
      emailConfirmed: true,
    }
    const first = await bootstrapAuthenticatedWorkspace(session)
    const localGoalId = 'ffffffff-2222-4222-8222-222222222222'
    await first.database.goals.put({
      ...originalGoal,
      id: localGoalId,
      name: 'Unmarked local mutation',
      updatedAt: 2,
    })
    snapshotState.revision = 1
    snapshotState.data = {
      version: 7,
      exportedAt: 2,
      goals: [{ ...originalGoal, name: 'Remote changed', updatedAt: 3 }],
      sessions: [],
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
      notes: [],
      questions: [],
      examAttempts: [],
    }

    const bootstrapped = await bootstrapAuthenticatedWorkspace(session)

    expect(bootstrapped.initialSyncStatus).toBe('conflict')
    expect(await bootstrapped.database.goals.get(localGoalId)).toBeDefined()
    expect((await bootstrapped.database.goals.get(originalGoal.id))?.name).toBe('Original')
  })
})

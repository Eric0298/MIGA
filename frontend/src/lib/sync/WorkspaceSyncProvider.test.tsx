import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateScopedDatabase,
  deactivateScopedDatabase,
  deleteAllScopedDatabases,
  type MigaDatabase,
} from '@/lib/db/miga-db'
import { WorkspaceSyncProvider, useWorkspaceSync } from './WorkspaceSyncProvider'

const snapshotApi = vi.hoisted(() => ({
  putSnapshot: vi.fn(),
  getSnapshot: vi.fn(),
}))

vi.mock('@/lib/api/snapshot-api', () => ({
  putSnapshot: snapshotApi.putSnapshot,
  getSnapshot: snapshotApi.getSnapshot,
}))

const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SCOPE_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SCOPE_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function Probe() {
  const sync = useWorkspaceSync()
  return (
    <>
      <span>{sync.status}</span>
      <button type="button" onClick={() => void sync.syncNow()}>
        sync
      </button>
      <button type="button" onClick={() => void sync.resolveConflict('keep-remote')}>
        keep-remote
      </button>
    </>
  )
}

function renderProvider(
  database: MigaDatabase,
  scopeKey = SCOPE_A,
  initialSyncStatus: 'synced' | 'pending' | 'conflict' = 'pending',
) {
  return render(
    <StrictMode>
      <WorkspaceSyncProvider
        database={database}
        scopeKey={scopeKey}
        workspaceId={WORKSPACE_ID}
        initialRevision={3}
        initialUpdatedAtUtc="2026-07-23T10:00:00.000Z"
        initialSyncStatus={initialSyncStatus}
      >
        <Probe />
      </WorkspaceSyncProvider>
    </StrictMode>,
  )
}

beforeEach(() => {
  snapshotApi.putSnapshot.mockReset()
  snapshotApi.getSnapshot.mockReset()
  snapshotApi.putSnapshot.mockImplementation(
    async (_workspaceId: string, revision: number, data: unknown) => ({
      revision: revision + 1,
      updatedAtUtc: '2026-07-23T11:00:00.000Z',
      data,
    }),
  )
})

afterEach(async () => {
  await deactivateScopedDatabase()
  await deleteAllScopedDatabases()
})

describe('WorkspaceSyncProvider scope safety', () => {
  it('sends the captured workspace id as a defensive PUT precondition', async () => {
    const database = activateScopedDatabase(SCOPE_A)
    await database.syncMetadata.put({
      id: 'workspace',
      revision: 3,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      dirty: true,
    })
    const user = userEvent.setup()
    renderProvider(database)

    await user.click(screen.getByRole('button', { name: 'sync' }))

    await waitFor(() => expect(snapshotApi.putSnapshot).toHaveBeenCalledOnce())
    expect(snapshotApi.putSnapshot.mock.calls[0]?.[0]).toBe(WORKSPACE_ID)
    expect(snapshotApi.putSnapshot.mock.calls[0]?.[1]).toBe(3)
  })

  it('never uploads from an old provider after another scope becomes active', async () => {
    const databaseA = activateScopedDatabase(SCOPE_A)
    await databaseA.syncMetadata.put({
      id: 'workspace',
      revision: 3,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      dirty: true,
    })
    const user = userEvent.setup()
    renderProvider(databaseA)
    activateScopedDatabase(SCOPE_B)

    await user.click(screen.getByRole('button', { name: 'sync' }))
    await Promise.resolve()

    expect(snapshotApi.putSnapshot).not.toHaveBeenCalled()
  })

  it('does not schedule server snapshots for device-local blob mutations', async () => {
    const database = activateScopedDatabase(SCOPE_A)
    await database.open()
    renderProvider(database, SCOPE_A, 'synced')

    await database.materialBlobs.put({
      id: '99999999-9999-4999-8999-999999999999',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    await new Promise((resolve) => window.setTimeout(resolve, 1_050))

    expect(snapshotApi.putSnapshot).not.toHaveBeenCalled()
    expect(screen.getByText('synced')).toBeVisible()
  })

  it('schedules a snapshot for a structured Dexie mutation', async () => {
    const database = activateScopedDatabase(SCOPE_A)
    await database.open()
    renderProvider(database, SCOPE_A, 'synced')

    await database.goals.put({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Structured mutation',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 1,
    })

    await waitFor(() => expect(snapshotApi.putSnapshot).toHaveBeenCalledOnce(), { timeout: 2_000 })
  })

  it('can choose the remote conflict copy without deleting local blobs', async () => {
    const database = activateScopedDatabase(SCOPE_A)
    await database.goals.put({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Conflicting local goal',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 1,
    })
    await database.materialBlobs.put({
      id: '99999999-9999-4999-8999-999999999999',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    snapshotApi.getSnapshot.mockResolvedValue({
      revision: 4,
      updatedAtUtc: '2026-07-23T11:00:00.000Z',
      data: {
        version: 7,
        exportedAt: 2,
        goals: [],
        sessions: [],
        materials: [],
        materialGoalLinks: [],
        materialProgress: [],
        notes: [],
        questions: [],
        examAttempts: [],
      },
    })
    const user = userEvent.setup()
    renderProvider(database, SCOPE_A, 'conflict')

    await user.click(screen.getByRole('button', { name: 'keep-remote' }))

    await waitFor(() => expect(screen.getByText('synced')).toBeVisible())
    expect(await database.goals.count()).toBe(0)
    expect(await database.materialBlobs.count()).toBe(1)
    expect(snapshotApi.putSnapshot).not.toHaveBeenCalled()
  })
})

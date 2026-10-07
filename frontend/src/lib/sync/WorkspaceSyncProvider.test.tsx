import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/http'
import { buildExportPayload } from '@/lib/db/import-export'
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
  it('uploads edits made while reconciling an already saved snapshot', async () => {
    const database = activateScopedDatabase(SCOPE_A)
    await database.syncMetadata.put({
      id: 'workspace',
      revision: 3,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      dirty: true,
    })
    const data = await buildExportPayload(database)
    let confirmSave!: (value: unknown) => void
    snapshotApi.putSnapshot.mockRejectedValueOnce(
      new ApiError(409, { code: 'snapshot_revision_conflict' }),
    )
    snapshotApi.getSnapshot.mockReturnValueOnce(
      new Promise((resolve) => {
        confirmSave = resolve
      }),
    )
    const user = userEvent.setup()
    renderProvider(database)
    await user.click(screen.getByRole('button', { name: 'sync' }))
    await waitFor(() => expect(snapshotApi.getSnapshot).toHaveBeenCalledOnce())

    await database.goals.put({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Edit during recovery',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 1,
    })
    await waitFor(() => expect(screen.getByText('pending')).toBeVisible())
    confirmSave({ revision: 4, updatedAtUtc: '2026-07-23T11:00:00.000Z', data })

    await waitFor(() => expect(snapshotApi.putSnapshot).toHaveBeenCalledTimes(2), {
      timeout: 2_000,
    })
    await waitFor(() => expect(screen.getByText('synced')).toBeVisible())
    expect(snapshotApi.putSnapshot.mock.calls[1]?.[1]).toBe(4)
    expect(snapshotApi.putSnapshot.mock.calls[1]?.[2]).toMatchObject({
      goals: [{ name: 'Edit during recovery' }],
    })
    expect(await database.syncMetadata.get('workspace')).toMatchObject({
      revision: 5,
      dirty: false,
    })
  })

  it('acknowledges a lost successful save when a revision conflict has identical server content', async () => {
    const database = activateScopedDatabase(SCOPE_A)
    await database.syncMetadata.put({
      id: 'workspace',
      revision: 3,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      dirty: true,
    })
    const data = await buildExportPayload(database)
    snapshotApi.putSnapshot.mockRejectedValueOnce(
      new ApiError(409, { code: 'snapshot_revision_conflict' }),
    )
    snapshotApi.getSnapshot.mockResolvedValue({
      revision: 4,
      updatedAtUtc: '2026-07-23T11:00:00.000Z',
      data,
    })
    const user = userEvent.setup()
    renderProvider(database)

    await user.click(screen.getByRole('button', { name: 'sync' }))

    await waitFor(() => expect(screen.getByText('synced')).toBeVisible())
    expect(snapshotApi.putSnapshot).toHaveBeenCalledOnce()
    expect(await database.syncMetadata.get('workspace')).toMatchObject({
      revision: 4,
      dirty: false,
    })
  })

  it('keeps a real conflict and local data when the server content differs', async () => {
    const database = activateScopedDatabase(SCOPE_A)
    const localData = await buildExportPayload(database)
    await database.goals.put({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Keep this local goal',
      targetMinutes: 60,
      scheduledDays: ['2026-07-23'],
      createdAt: 1,
      updatedAt: 1,
    })
    await database.syncMetadata.put({
      id: 'workspace',
      revision: 3,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      dirty: true,
    })
    snapshotApi.putSnapshot.mockRejectedValueOnce(
      new ApiError(409, { code: 'snapshot_revision_conflict' }),
    )
    snapshotApi.getSnapshot.mockResolvedValue({
      revision: 4,
      updatedAtUtc: '2026-07-23T11:00:00.000Z',
      data: localData,
    })
    const user = userEvent.setup()
    renderProvider(database)

    await user.click(screen.getByRole('button', { name: 'sync' }))

    await waitFor(() => expect(screen.getByText('conflict')).toBeVisible())
    expect(snapshotApi.getSnapshot).toHaveBeenCalledOnce()
    expect(await database.goals.toArray()).toMatchObject([{ name: 'Keep this local goal' }])
    expect(await database.syncMetadata.get('workspace')).toMatchObject({
      revision: 3,
      dirty: true,
    })
  })

  it('does not acknowledge a save rejected because the server account scope changed', async () => {
    const database = activateScopedDatabase(SCOPE_A)
    await database.syncMetadata.put({
      id: 'workspace',
      revision: 3,
      updatedAtUtc: '2026-07-23T10:00:00.000Z',
      dirty: true,
    })
    snapshotApi.putSnapshot.mockRejectedValueOnce(
      new ApiError(409, { code: 'workspace_scope_mismatch' }),
    )
    const user = userEvent.setup()
    renderProvider(database)

    await user.click(screen.getByRole('button', { name: 'sync' }))

    await waitFor(() => expect(screen.getByText('conflict')).toBeVisible())
    expect(snapshotApi.getSnapshot).not.toHaveBeenCalled()
    expect(await database.syncMetadata.get('workspace')).toMatchObject({
      revision: 3,
      dirty: true,
    })
  })

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

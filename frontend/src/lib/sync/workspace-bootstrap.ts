import type { AuthenticatedSession } from '@/lib/api/auth-api'
import { getSnapshot } from '@/lib/api/snapshot-api'
import { buildExportPayload, replaceStructuredData } from '@/lib/db/import-export'
import {
  activateScopedDatabase,
  deactivateScopedDatabase,
  getActiveDatabaseScope,
  type MigaDatabase,
  type WorkspaceSyncMetadata,
} from '@/lib/db/miga-db'
import { workspaceContentHash } from './content-hash'
import { getWorkspaceSyncMetadata, putWorkspaceSyncMetadata } from './sync-metadata'

export type WorkspaceBootstrapResult = {
  scopeKey: string
  workspaceId: string
  database: MigaDatabase
  revision: number
  updatedAtUtc: string
  initialSyncStatus: 'synced' | 'pending' | 'conflict'
}

let bootstrapTail: Promise<void> = Promise.resolve()

function sessionIdentity(session: AuthenticatedSession): string {
  return session.workspaceId
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function scopeKeyForSession(session: AuthenticatedSession): Promise<string> {
  return (await sha256Hex(sessionIdentity(session))).slice(0, 32)
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Workspace bootstrap aborted', 'AbortError')
}

async function hasStructuredData(database: MigaDatabase): Promise<boolean> {
  const counts = await database.transaction(
    'r',
    [
      database.goals,
      database.sessions,
      database.materials,
      database.materialGoalLinks,
      database.materialProgress,
      database.notes,
      database.questions,
      database.examAttempts,
    ],
    () =>
      Promise.all([
        database.goals.count(),
        database.sessions.count(),
        database.materials.count(),
        database.materialGoalLinks.count(),
        database.materialProgress.count(),
        database.notes.count(),
        database.questions.count(),
        database.examAttempts.count(),
      ]),
  )
  return counts.some((count) => count > 0)
}

function result(
  session: AuthenticatedSession,
  scopeKey: string,
  database: MigaDatabase,
  metadata: Pick<WorkspaceSyncMetadata, 'revision' | 'updatedAtUtc'>,
  initialSyncStatus: WorkspaceBootstrapResult['initialSyncStatus'],
): WorkspaceBootstrapResult {
  return {
    scopeKey,
    workspaceId: session.workspaceId,
    database,
    revision: metadata.revision,
    updatedAtUtc: metadata.updatedAtUtc,
    initialSyncStatus,
  }
}

async function preserveLocal(
  session: AuthenticatedSession,
  scopeKey: string,
  database: MigaDatabase,
  metadata: Omit<WorkspaceSyncMetadata, 'id'>,
  status: 'pending' | 'conflict',
): Promise<WorkspaceBootstrapResult> {
  await putWorkspaceSyncMetadata({ ...metadata, dirty: true }, database)
  return result(session, scopeKey, database, metadata, status)
}

async function runBootstrap(
  session: AuthenticatedSession,
  signal?: AbortSignal,
): Promise<WorkspaceBootstrapResult> {
  throwIfAborted(signal)
  const scopeKey = await scopeKeyForSession(session)
  throwIfAborted(signal)

  const previousScope = getActiveDatabaseScope()
  if (previousScope && previousScope !== scopeKey) {
    await deactivateScopedDatabase()
  }
  throwIfAborted(signal)
  const database = activateScopedDatabase(scopeKey)

  const [localSyncMetadata, localHasData] = await Promise.all([
    getWorkspaceSyncMetadata(database),
    hasStructuredData(database),
  ])
  throwIfAborted(signal)
  const snapshot = await getSnapshot(signal)
  throwIfAborted(signal)

  const remoteHasData =
    snapshot.data.goals.length > 0 ||
    snapshot.data.sessions.length > 0 ||
    snapshot.data.materials.length > 0 ||
    snapshot.data.materialGoalLinks.length > 0 ||
    snapshot.data.materialProgress.length > 0 ||
    snapshot.data.notes.length > 0 ||
    snapshot.data.questions.length > 0 ||
    snapshot.data.examAttempts.length > 0
  const remoteHash = await workspaceContentHash(snapshot.data)
  let localHash: string | undefined
  try {
    localHash = await workspaceContentHash(await buildExportPayload(database))
  } catch {
    // Invalid or over-limit local state must be preserved for explicit
    // recovery; it is never a reason to replace it with a server snapshot.
    if (localHasData) {
      const metadata = localSyncMetadata ?? {
        revision: snapshot.revision,
        updatedAtUtc: snapshot.updatedAtUtc,
        dirty: true,
      }
      return preserveLocal(session, scopeKey, database, metadata, 'conflict')
    }
  }
  throwIfAborted(signal)

  if (localSyncMetadata?.dirty) {
    return result(
      session,
      scopeKey,
      database,
      localSyncMetadata,
      snapshot.revision === localSyncMetadata.revision ? 'pending' : 'conflict',
    )
  }

  if (!localSyncMetadata && localHasData) {
    return preserveLocal(
      session,
      scopeKey,
      database,
      {
        revision: snapshot.revision,
        updatedAtUtc: snapshot.updatedAtUtc,
        dirty: true,
        contentHash: localHash,
      },
      remoteHasData ? 'conflict' : 'pending',
    )
  }

  if (localSyncMetadata && snapshot.revision < localSyncMetadata.revision) {
    return preserveLocal(
      session,
      scopeKey,
      database,
      { ...localSyncMetadata, contentHash: localHash ?? localSyncMetadata.contentHash },
      'conflict',
    )
  }

  if (localSyncMetadata && snapshot.revision === localSyncMetadata.revision) {
    if (localHash === remoteHash) {
      const metadata = {
        revision: snapshot.revision,
        updatedAtUtc: snapshot.updatedAtUtc,
        dirty: false,
        contentHash: remoteHash,
      }
      await putWorkspaceSyncMetadata(metadata, database)
      return result(session, scopeKey, database, metadata, 'synced')
    }
    return preserveLocal(
      session,
      scopeKey,
      database,
      { ...localSyncMetadata, contentHash: localHash ?? localSyncMetadata.contentHash },
      'conflict',
    )
  }

  if (
    localSyncMetadata &&
    snapshot.revision > localSyncMetadata.revision &&
    localHasData &&
    (!localSyncMetadata.contentHash || localHash !== localSyncMetadata.contentHash)
  ) {
    return preserveLocal(
      session,
      scopeKey,
      database,
      { ...localSyncMetadata, contentHash: localHash ?? localSyncMetadata.contentHash },
      'conflict',
    )
  }

  const metadata: WorkspaceSyncMetadata = {
    id: 'workspace',
    revision: snapshot.revision,
    updatedAtUtc: snapshot.updatedAtUtc,
    dirty: false,
    contentHash: remoteHash,
  }
  await replaceStructuredData(snapshot.data, database, metadata)
  throwIfAborted(signal)
  return result(session, scopeKey, database, metadata, 'synced')
}

/**
 * Identity bootstraps are globally serialized. Each run captures its own
 * database instance, so an older asynchronous run cannot write into the scope
 * activated by a newer session.
 */
export function bootstrapAuthenticatedWorkspace(
  session: AuthenticatedSession,
  signal?: AbortSignal,
): Promise<WorkspaceBootstrapResult> {
  const promise = bootstrapTail.then(() => runBootstrap(session, signal))
  bootstrapTail = promise.then(
    () => undefined,
    () => undefined,
  )
  return promise
}

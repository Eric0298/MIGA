import type { AuthenticatedSession } from '@/lib/api/auth-api'
import { getSnapshot } from '@/lib/api/snapshot-api'
import {
  activateScopedDatabase,
  deactivateScopedDatabase,
  getActiveDatabaseScope,
} from '@/lib/db/miga-db'
import { replaceStructuredData } from '@/lib/db/import-export'
import { getWorkspaceSyncMetadata, putWorkspaceSyncMetadata } from './sync-metadata'

export type WorkspaceBootstrapResult = {
  scopeKey: string
  revision: number
  updatedAtUtc: string
  initialSyncStatus: 'synced' | 'pending' | 'conflict'
}

let pendingBootstrap: {
  identity: string
  promise: Promise<WorkspaceBootstrapResult>
} | null = null

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

async function runBootstrap(session: AuthenticatedSession): Promise<WorkspaceBootstrapResult> {
  const scopeKey = await scopeKeyForSession(session)
  const previousScope = getActiveDatabaseScope()
  if (previousScope && previousScope !== scopeKey) {
    // Keep the inactive scope on this device: it may contain attachments that
    // are deliberately excluded from server snapshots. Deactivation closes it
    // before the new identity is activated, preventing cross-scope reads.
    await deactivateScopedDatabase(false)
  }
  activateScopedDatabase(scopeKey)

  // Validate the complete server snapshot before replacing any local state.
  const localSyncMetadata = await getWorkspaceSyncMetadata()
  const snapshot = await getSnapshot()
  if (localSyncMetadata?.dirty) {
    return {
      scopeKey,
      revision: localSyncMetadata.revision,
      updatedAtUtc: localSyncMetadata.updatedAtUtc,
      initialSyncStatus: snapshot.revision === localSyncMetadata.revision ? 'pending' : 'conflict',
    }
  }

  await replaceStructuredData(snapshot.data)
  await putWorkspaceSyncMetadata({
    revision: snapshot.revision,
    updatedAtUtc: snapshot.updatedAtUtc,
    dirty: false,
  })

  return {
    scopeKey,
    revision: snapshot.revision,
    updatedAtUtc: snapshot.updatedAtUtc,
    initialSyncStatus: 'synced',
  }
}

export function bootstrapAuthenticatedWorkspace(
  session: AuthenticatedSession,
): Promise<WorkspaceBootstrapResult> {
  const identity = sessionIdentity(session)
  if (pendingBootstrap?.identity === identity) return pendingBootstrap.promise

  const promise = runBootstrap(session).finally(() => {
    if (pendingBootstrap?.promise === promise) pendingBootstrap = null
  })
  pendingBootstrap = { identity, promise }
  return promise
}

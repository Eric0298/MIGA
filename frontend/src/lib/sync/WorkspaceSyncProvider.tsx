import Dexie, { type ObservabilitySet } from 'dexie'
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
import { ApiError } from '@/lib/api/http'
import { getSnapshot, putSnapshot } from '@/lib/api/snapshot-api'
import { SnapshotSizeLimitError } from '@/lib/db/data-limits'
import {
  buildExportPayload,
  replaceStructuredData,
  type ExportPayload,
} from '@/lib/db/import-export'
import { isActiveDatabase, type MigaDatabase } from '@/lib/db/miga-db'
import { workspaceContentHash } from './content-hash'
import { getWorkspaceSyncMetadata, putWorkspaceSyncMetadata } from './sync-metadata'

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'conflict' | 'error'
export type ConflictResolution = 'keep-local' | 'keep-remote'

type WorkspaceSyncContextValue = {
  status: SyncStatus
  revision: number
  lastSyncedAtUtc: string | null
  syncNow: () => Promise<boolean>
  resolveConflict: (resolution: ConflictResolution) => Promise<boolean>
}

type LockManagerLike = {
  request<T>(
    name: string,
    options: { mode: 'exclusive'; signal?: AbortSignal },
    callback: () => Promise<T>,
  ): Promise<T>
}

const WorkspaceSyncContext = createContext<WorkspaceSyncContextValue | null>(null)
const DEBOUNCE_MS = 900
const BASE_RETRY_MS = 5_000
const MAX_RETRY_MS = 60_000
const activeSyncControllers = new Set<AbortController>()
const LOCAL_ONLY_STORES = ['syncMetadata', 'materialBlobs', 'noteBlobs', 'questionBlobs'] as const

export function abortActiveWorkspaceSync(): void {
  for (const controller of activeSyncControllers) controller.abort()
  activeSyncControllers.clear()
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError'
}

async function withWorkspaceLock<T>(
  scopeKey: string,
  signal: AbortSignal,
  operation: () => Promise<T>,
): Promise<T> {
  const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks
  if (!locks) return operation()
  return locks.request(`miga-workspace-sync-${scopeKey}`, { mode: 'exclusive', signal }, operation)
}

function hasActiveScope(database: MigaDatabase, scopeKey: string, signal: AbortSignal): boolean {
  return !signal.aborted && isActiveDatabase(database, scopeKey)
}

export function WorkspaceSyncProvider({
  database,
  scopeKey,
  workspaceId,
  initialRevision,
  initialUpdatedAtUtc,
  initialSyncStatus,
  children,
}: {
  database: MigaDatabase
  scopeKey: string
  workspaceId: string
  initialRevision: number
  initialUpdatedAtUtc: string
  initialSyncStatus: 'synced' | 'pending' | 'conflict'
  children: ReactNode
}) {
  const [status, setStatus] = useState<SyncStatus>(initialSyncStatus)
  const [revision, setRevision] = useState(initialRevision)
  const [lastSyncedAtUtc, setLastSyncedAtUtc] = useState<string | null>(initialUpdatedAtUtc)
  const revisionRef = useRef(initialRevision)
  const lastSyncedAtUtcRef = useRef(initialUpdatedAtUtc)
  const statusRef = useRef<SyncStatus>(initialSyncStatus)
  const timerRef = useRef<number | null>(null)
  const savingPromiseRef = useRef<Promise<boolean> | null>(null)
  const dirtyRef = useRef(initialSyncStatus !== 'synced')
  const mountedRef = useRef(true)
  const retryAttemptRef = useRef(0)
  const abortControllerRef = useRef(new AbortController())
  const syncNowRef = useRef<() => Promise<boolean>>(async () => false)

  const updateStatus = useCallback((next: SyncStatus) => {
    statusRef.current = next
    if (mountedRef.current) setStatus(next)
  }, [])

  const updateRevision = useCallback((nextRevision: number, updatedAtUtc: string) => {
    revisionRef.current = nextRevision
    lastSyncedAtUtcRef.current = updatedAtUtc
    if (mountedRef.current) {
      setRevision(nextRevision)
      setLastSyncedAtUtc(updatedAtUtc)
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleRetry = useCallback(
    (delayMs: number) => {
      clearTimer()
      if (!mountedRef.current || abortControllerRef.current.signal.aborted) return
      timerRef.current = window.setTimeout(() => void syncNowRef.current(), delayMs)
    },
    [clearTimer],
  )

  const syncNow = useCallback((): Promise<boolean> => {
    clearTimer()
    if (savingPromiseRef.current) return savingPromiseRef.current
    if (statusRef.current === 'conflict') return Promise.resolve(false)
    if (!dirtyRef.current) return Promise.resolve(statusRef.current === 'synced')

    const signal = abortControllerRef.current.signal
    const save = async (): Promise<boolean> => {
      if (!hasActiveScope(database, scopeKey, signal)) return false
      dirtyRef.current = false
      updateStatus('syncing')
      try {
        return await withWorkspaceLock(scopeKey, signal, async () => {
          if (!hasActiveScope(database, scopeKey, signal)) return false
          const metadata = await getWorkspaceSyncMetadata(database)
          if (!hasActiveScope(database, scopeKey, signal)) return false

          const data = await buildExportPayload(database)
          const contentHash = await workspaceContentHash(data)
          if (!hasActiveScope(database, scopeKey, signal)) return false

          if (metadata && !metadata.dirty && metadata.contentHash === contentHash) {
            dirtyRef.current = false
            retryAttemptRef.current = 0
            updateRevision(metadata.revision, metadata.updatedAtUtc)
            updateStatus('synced')
            return true
          }

          const baseRevision = metadata?.revision ?? revisionRef.current
          const saved = await putSnapshot(workspaceId, baseRevision, data, signal)
          if (!hasActiveScope(database, scopeKey, signal)) return false

          updateRevision(saved.revision, saved.updatedAtUtc)
          await putWorkspaceSyncMetadata(
            {
              revision: saved.revision,
              updatedAtUtc: saved.updatedAtUtc,
              dirty: dirtyRef.current,
              contentHash,
            },
            database,
          )
          retryAttemptRef.current = 0
          updateStatus(dirtyRef.current ? 'pending' : 'synced')
          return !dirtyRef.current
        })
      } catch (cause) {
        if (isAbortError(cause) || signal.aborted || !isActiveDatabase(database, scopeKey)) {
          return false
        }

        dirtyRef.current = true
        if (cause instanceof ApiError && cause.status === 409) {
          updateStatus('conflict')
        } else if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
          updateStatus('error')
        } else if (cause instanceof SnapshotSizeLimitError) {
          updateStatus('error')
        } else {
          updateStatus('error')
          retryAttemptRef.current += 1
          const exponential = Math.min(
            MAX_RETRY_MS,
            BASE_RETRY_MS * 2 ** (retryAttemptRef.current - 1),
          )
          const retryAfter =
            cause instanceof ApiError && cause.status === 429 ? cause.retryAfterMs : null
          const delay = retryAfter ?? Math.round(exponential * (0.8 + Math.random() * 0.4))
          scheduleRetry(delay)
        }
        const currentMetadata = await getWorkspaceSyncMetadata(database).catch(() => undefined)
        await putWorkspaceSyncMetadata(
          {
            revision: currentMetadata?.revision ?? revisionRef.current,
            updatedAtUtc: currentMetadata?.updatedAtUtc ?? lastSyncedAtUtcRef.current,
            dirty: true,
            contentHash: currentMetadata?.contentHash,
          },
          database,
        ).catch(() => undefined)
        return false
      } finally {
        savingPromiseRef.current = null
        if (
          dirtyRef.current &&
          statusRef.current === 'pending' &&
          mountedRef.current &&
          !signal.aborted
        ) {
          scheduleRetry(DEBOUNCE_MS)
        }
      }
    }

    const promise = save()
    savingPromiseRef.current = promise
    return promise
  }, [clearTimer, database, scheduleRetry, scopeKey, updateRevision, updateStatus, workspaceId])

  useEffect(() => {
    syncNowRef.current = syncNow
  }, [syncNow])

  const scheduleSync = useCallback(() => {
    if (statusRef.current === 'conflict' || abortControllerRef.current.signal.aborted) return
    dirtyRef.current = true
    updateStatus('pending')
    void getWorkspaceSyncMetadata(database)
      .then((metadata) =>
        putWorkspaceSyncMetadata(
          {
            revision: metadata?.revision ?? revisionRef.current,
            updatedAtUtc: metadata?.updatedAtUtc ?? lastSyncedAtUtcRef.current,
            dirty: true,
            contentHash: metadata?.contentHash,
          },
          database,
        ),
      )
      .catch(() => updateStatus('error'))
    clearTimer()
    timerRef.current = window.setTimeout(() => void syncNow(), DEBOUNCE_MS)
  }, [clearTimer, database, syncNow, updateStatus])

  const resolveConflict = useCallback(
    async (resolution: ConflictResolution): Promise<boolean> => {
      clearTimer()
      if (
        savingPromiseRef.current ||
        !hasActiveScope(database, scopeKey, abortControllerRef.current.signal)
      ) {
        return false
      }
      const signal = abortControllerRef.current.signal
      updateStatus('syncing')
      try {
        return await withWorkspaceLock(scopeKey, signal, async () => {
          const remote = await getSnapshot(signal)
          if (!hasActiveScope(database, scopeKey, signal)) return false

          if (resolution === 'keep-remote') {
            const contentHash = await workspaceContentHash(remote.data)
            await replaceStructuredData(remote.data, database, {
              id: 'workspace',
              revision: remote.revision,
              updatedAtUtc: remote.updatedAtUtc,
              dirty: false,
              contentHash,
            })
            dirtyRef.current = false
            updateRevision(remote.revision, remote.updatedAtUtc)
            updateStatus('synced')
            return true
          }

          const local: ExportPayload = await buildExportPayload(database)
          const contentHash = await workspaceContentHash(local)
          const saved = await putSnapshot(workspaceId, remote.revision, local, signal)
          await putWorkspaceSyncMetadata(
            {
              revision: saved.revision,
              updatedAtUtc: saved.updatedAtUtc,
              dirty: false,
              contentHash,
            },
            database,
          )
          dirtyRef.current = false
          updateRevision(saved.revision, saved.updatedAtUtc)
          updateStatus('synced')
          return true
        })
      } catch (cause) {
        if (!isAbortError(cause) && !signal.aborted) updateStatus('conflict')
        return false
      }
    },
    [clearTimer, database, scopeKey, updateRevision, updateStatus, workspaceId],
  )

  useEffect(() => {
    mountedRef.current = true
    if (abortControllerRef.current.signal.aborted) {
      abortControllerRef.current = new AbortController()
    }
    const controller = abortControllerRef.current
    activeSyncControllers.add(controller)
    const databasePrefix = `idb://${database.name}/`
    const handleStorageMutation = (parts: ObservabilitySet) => {
      if (
        Object.keys(parts).some(
          (part) =>
            part.startsWith(databasePrefix) &&
            !LOCAL_ONLY_STORES.some(
              (store) =>
                part === `${databasePrefix}${store}` ||
                part.startsWith(`${databasePrefix}${store}/`),
            ),
        )
      ) {
        scheduleSync()
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') void syncNow()
    }
    const handleOnline = () => {
      if (dirtyRef.current) void syncNow()
    }

    Dexie.on('storagemutated', handleStorageMutation)
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)
    if (initialSyncStatus === 'pending') {
      timerRef.current = window.setTimeout(() => void syncNow(), DEBOUNCE_MS)
    }
    return () => {
      mountedRef.current = false
      controller.abort()
      activeSyncControllers.delete(controller)
      clearTimer()
      Dexie.on.storagemutated.unsubscribe(handleStorageMutation)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [clearTimer, database.name, initialSyncStatus, scheduleSync, syncNow])

  const value = useMemo<WorkspaceSyncContextValue>(
    () => ({ status, revision, lastSyncedAtUtc, syncNow, resolveConflict }),
    [status, revision, lastSyncedAtUtc, syncNow, resolveConflict],
  )

  return <WorkspaceSyncContext.Provider value={value}>{children}</WorkspaceSyncContext.Provider>
}

export function useWorkspaceSync(): WorkspaceSyncContextValue {
  const context = useContext(WorkspaceSyncContext)
  if (!context) {
    return {
      status: 'synced',
      revision: 0,
      lastSyncedAtUtc: null,
      syncNow: async () => true,
      resolveConflict: async () => false,
    }
  }
  return context
}

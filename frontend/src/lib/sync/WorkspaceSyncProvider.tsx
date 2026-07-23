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
import { putSnapshot } from '@/lib/api/snapshot-api'
import { buildExportPayload } from '@/lib/db/import-export'
import { getActiveDatabaseName } from '@/lib/db/miga-db'
import { putWorkspaceSyncMetadata } from './sync-metadata'

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'conflict' | 'error'

type WorkspaceSyncContextValue = {
  status: SyncStatus
  revision: number
  lastSyncedAtUtc: string | null
  syncNow: () => Promise<boolean>
}

const WorkspaceSyncContext = createContext<WorkspaceSyncContextValue | null>(null)
const DEBOUNCE_MS = 900
const RETRY_MS = 5_000

export function WorkspaceSyncProvider({
  initialRevision,
  initialUpdatedAtUtc,
  initialSyncStatus,
  children,
}: {
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
  const syncNowRef = useRef<() => Promise<boolean>>(async () => false)

  const updateStatus = useCallback((next: SyncStatus) => {
    statusRef.current = next
    if (mountedRef.current) setStatus(next)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const syncNow = useCallback((): Promise<boolean> => {
    clearTimer()
    if (savingPromiseRef.current) return savingPromiseRef.current
    if (statusRef.current === 'conflict') return Promise.resolve(false)
    if (!dirtyRef.current) return Promise.resolve(statusRef.current === 'synced')

    const save = async (): Promise<boolean> => {
      dirtyRef.current = false
      updateStatus('syncing')
      try {
        const data = await buildExportPayload()
        const saved = await putSnapshot(revisionRef.current, data)
        revisionRef.current = saved.revision
        lastSyncedAtUtcRef.current = saved.updatedAtUtc
        await putWorkspaceSyncMetadata({
          revision: saved.revision,
          updatedAtUtc: saved.updatedAtUtc,
          dirty: dirtyRef.current,
        })
        if (mountedRef.current) {
          setRevision(saved.revision)
          setLastSyncedAtUtc(saved.updatedAtUtc)
        }
        updateStatus(dirtyRef.current ? 'pending' : 'synced')
        return !dirtyRef.current
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 409) {
          // Never pull over unsaved local state or retry with a newer revision.
          dirtyRef.current = true
          updateStatus('conflict')
        } else {
          dirtyRef.current = true
          updateStatus('error')
          timerRef.current = window.setTimeout(() => void syncNowRef.current(), RETRY_MS)
        }
        void putWorkspaceSyncMetadata({
          revision: revisionRef.current,
          updatedAtUtc: lastSyncedAtUtcRef.current,
          dirty: true,
        }).catch(() => undefined)
        return false
      } finally {
        savingPromiseRef.current = null
        if (dirtyRef.current && statusRef.current === 'pending') {
          timerRef.current = window.setTimeout(() => void syncNow(), DEBOUNCE_MS)
        }
      }
    }

    const promise = save()
    savingPromiseRef.current = promise
    return promise
  }, [clearTimer, updateStatus])

  useEffect(() => {
    syncNowRef.current = syncNow
  }, [syncNow])

  const scheduleSync = useCallback(() => {
    if (statusRef.current === 'conflict') return
    dirtyRef.current = true
    updateStatus('pending')
    void putWorkspaceSyncMetadata({
      revision: revisionRef.current,
      updatedAtUtc: lastSyncedAtUtcRef.current,
      dirty: true,
    }).catch(() => updateStatus('error'))
    clearTimer()
    timerRef.current = window.setTimeout(() => void syncNow(), DEBOUNCE_MS)
  }, [clearTimer, syncNow, updateStatus])

  useEffect(() => {
    mountedRef.current = true
    const databasePrefix = `idb://${getActiveDatabaseName()}/`
    const handleStorageMutation = (parts: ObservabilitySet) => {
      if (
        Object.keys(parts).some(
          (part) =>
            part.startsWith(databasePrefix) && !part.startsWith(`${databasePrefix}syncMetadata/`),
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
      clearTimer()
      Dexie.on.storagemutated.unsubscribe(handleStorageMutation)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [clearTimer, initialSyncStatus, scheduleSync, syncNow])

  const value = useMemo<WorkspaceSyncContextValue>(
    () => ({ status, revision, lastSyncedAtUtc, syncNow }),
    [status, revision, lastSyncedAtUtc, syncNow],
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
    }
  }
  return context
}

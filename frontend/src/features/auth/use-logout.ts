import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useWorkspaceSync } from '@/lib/sync/WorkspaceSyncProvider'
import { useAuth } from './AuthProvider'

/**
 * Coordinates the sign-out flow reused by AccountPanel and the side nav.
 * Kept in a single hook so both entry points behave identically: best-effort
 * sync of dirty local changes, then server session revocation, then a
 * redirect to the landing page. `syncNow()` failures do not block sign-out;
 * pending changes stay in the scoped local database for the next session.
 */
export function useLogoutFlow(): {
  logout: () => Promise<void>
  busy: boolean
} {
  const auth = useAuth()
  const sync = useWorkspaceSync()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const inFlightRef = useRef(false)

  const logout = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setBusy(true)
    try {
      try {
        await sync.syncNow()
      } catch {
        // Sync errors must not block session revocation. Local changes are
        // preserved in the scoped IndexedDB database.
      }
      await auth.logout()
      navigate('/', { replace: true })
    } finally {
      inFlightRef.current = false
      setBusy(false)
    }
  }, [auth, navigate, sync])

  return { logout, busy }
}

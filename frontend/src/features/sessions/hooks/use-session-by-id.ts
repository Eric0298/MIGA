import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'

/**
 * Live-loads a single session row. Returns `undefined` while loading, `null`
 * when the id does not exist and the session record otherwise.
 */
export function useSessionById(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return null
    return (await db.sessions.get(id)) ?? null
  }, [id])
}

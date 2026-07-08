import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'

export function useLiveGoal(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return null
    return (await db.goals.get(id)) ?? null
  }, [id])
}

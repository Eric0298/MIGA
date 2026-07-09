import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'

export function useMaterial(id: string | null | undefined) {
  return useLiveQuery(async () => {
    if (!id) return null
    return (await db.materials.get(id)) ?? null
  }, [id])
}

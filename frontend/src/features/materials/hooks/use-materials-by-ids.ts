import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'
import type { Material } from '@/lib/db/schema'

/**
 * Live-loads a set of materials by id, keeping the order of the input array.
 * Missing materials are silently skipped.
 */
export function useMaterialsByIds(ids: string[]): Material[] {
  const materials = useLiveQuery(async () => {
    if (ids.length === 0) return []
    return db.materials.where('id').anyOf(ids).toArray()
  }, [ids.join('|')])
  if (!materials) return []
  const byId = new Map(materials.map((m) => [m.id, m]))
  return ids.map((id) => byId.get(id)).filter((m): m is Material => m !== undefined)
}

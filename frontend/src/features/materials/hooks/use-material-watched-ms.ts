import { useLiveQuery } from 'dexie-react-hooks'
import { getTotalWatchedMsByMaterial } from '@/lib/db/material-progress.repository'

export function useMaterialWatchedMs(materialId: string | null | undefined): number {
  const total = useLiveQuery(async () => {
    if (!materialId) return 0
    return getTotalWatchedMsByMaterial(materialId)
  }, [materialId])
  return total ?? 0
}

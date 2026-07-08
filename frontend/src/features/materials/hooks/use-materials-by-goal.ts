import { useLiveQuery } from 'dexie-react-hooks'
import { listMaterialsByGoal } from '@/lib/db/materials.repository'

export function useMaterialsByGoal(goalId: string | undefined) {
  return useLiveQuery(async () => {
    if (!goalId) return []
    return listMaterialsByGoal(goalId)
  }, [goalId])
}

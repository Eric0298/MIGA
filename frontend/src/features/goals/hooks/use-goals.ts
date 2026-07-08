import { useLiveQuery } from 'dexie-react-hooks'
import { listGoals } from '@/lib/db/goals.repository'

export function useLiveGoals() {
  return useLiveQuery(() => listGoals(), [])
}

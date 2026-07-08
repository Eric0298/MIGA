import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveSession } from '@/lib/db/sessions.repository'

export function useActiveSession() {
  return useLiveQuery(() => getActiveSession(), [])
}

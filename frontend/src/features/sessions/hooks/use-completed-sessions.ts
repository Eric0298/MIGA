import { useLiveQuery } from 'dexie-react-hooks'
import { listCompletedSessions } from '@/lib/db/sessions.repository'

export function useCompletedSessions() {
  return useLiveQuery(() => listCompletedSessions(), [])
}

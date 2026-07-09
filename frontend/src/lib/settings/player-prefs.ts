import { useEffect, useState } from 'react'

export const SYNC_TIMER_VIDEO_KEY = 'miga.syncTimerVideo'

export function readSyncTimerVideo(): boolean {
  try {
    const raw = localStorage.getItem(SYNC_TIMER_VIDEO_KEY)
    // Default true: video play/pause drives the session timer unless the
    // user has explicitly opted out (raw === 'false').
    return raw === null ? true : raw !== 'false'
  } catch {
    return true
  }
}

export function writeSyncTimerVideo(value: boolean): void {
  try {
    localStorage.setItem(SYNC_TIMER_VIDEO_KEY, value ? 'true' : 'false')
    window.dispatchEvent(
      new CustomEvent('miga:player-prefs-changed', { detail: { syncTimerVideo: value } }),
    )
  } catch {
    // ignore
  }
}

export function useSyncTimerVideo(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readSyncTimerVideo())

  useEffect(() => {
    const handleChange = () => setEnabled(readSyncTimerVideo())
    window.addEventListener('miga:player-prefs-changed', handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener('miga:player-prefs-changed', handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [])

  const setValue = (next: boolean) => {
    writeSyncTimerVideo(next)
    setEnabled(next)
  }

  return [enabled, setValue]
}

import { useEffect, useState } from 'react'

export const SYNC_TIMER_VIDEO_KEY = 'miga.syncTimerVideo'

export function readSyncTimerVideo(): boolean {
  try {
    return localStorage.getItem(SYNC_TIMER_VIDEO_KEY) === 'true'
  } catch {
    return false
  }
}

export function writeSyncTimerVideo(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(SYNC_TIMER_VIDEO_KEY, 'true')
    } else {
      localStorage.removeItem(SYNC_TIMER_VIDEO_KEY)
    }
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

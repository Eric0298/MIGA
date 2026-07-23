import { describe, expect, it, vi } from 'vitest'
import { confirmLogoutSafety } from './logout-safety'

describe('logout safety', () => {
  it('requires a specific confirmation when synchronized local files would be deleted', async () => {
    const confirm = vi.fn(() => false)
    const inspectLocalBlobs = vi.fn(async () => ({ count: 3, bytes: 4_096 }))

    const result = await confirmLogoutSafety({
      syncNow: async () => true,
      inspectLocalBlobs,
      confirm,
      unsyncedMessage: 'unsynced',
      localFilesMessage: ({ count, bytes }) => `local:${count}:${bytes}`,
    })

    expect(result).toBe(false)
    expect(inspectLocalBlobs).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledExactlyOnceWith('local:3:4096')
  })

  it('does not inspect files after the user cancels the unsynchronized-data warning', async () => {
    const confirm = vi.fn(() => false)
    const inspectLocalBlobs = vi.fn(async () => ({ count: 1, bytes: 10 }))

    const result = await confirmLogoutSafety({
      syncNow: async () => false,
      inspectLocalBlobs,
      confirm,
      unsyncedMessage: 'unsynced',
      localFilesMessage: () => 'local',
    })

    expect(result).toBe(false)
    expect(confirm).toHaveBeenCalledExactlyOnceWith('unsynced')
    expect(inspectLocalBlobs).not.toHaveBeenCalled()
  })
})

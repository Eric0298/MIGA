import { beforeEach, describe, expect, it, vi } from 'vitest'
import { putSnapshot } from './snapshot-api'

const http = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}))

vi.mock('./http', () => ({
  apiRequest: http.apiRequest,
}))

const EMPTY_PAYLOAD = {
  version: 7 as const,
  exportedAt: 1,
  goals: [],
  sessions: [],
  materials: [],
  materialGoalLinks: [],
  materialProgress: [],
  notes: [],
  questions: [],
  examAttempts: [],
}

beforeEach(() => {
  http.apiRequest.mockReset()
  http.apiRequest.mockResolvedValue({
    revision: 4,
    updatedAtUtc: '2026-07-23T11:00:00.000Z',
    data: EMPTY_PAYLOAD,
  })
})

describe('snapshot API preconditions', () => {
  it('includes the captured workspace id in every PUT', async () => {
    const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

    await putSnapshot(workspaceId, 3, EMPTY_PAYLOAD)

    expect(http.apiRequest).toHaveBeenCalledExactlyOnceWith('/api/data/snapshot', {
      method: 'PUT',
      json: { workspaceId, revision: 3, data: EMPTY_PAYLOAD },
      signal: undefined,
    })
  })

  it('rejects an invalid workspace id before making a request', async () => {
    await expect(putSnapshot('not-a-workspace', 3, EMPTY_PAYLOAD)).rejects.toThrow()
    expect(http.apiRequest).not.toHaveBeenCalled()
  })
})

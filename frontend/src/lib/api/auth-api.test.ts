import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  confirmEmail,
  listAccountSessions,
  revokeAccountSession,
  revokeOtherAccountSessions,
} from './auth-api'

const http = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}))

vi.mock('./http', () => ({
  apiRequest: http.apiRequest,
  apiDownload: vi.fn(),
  clearInMemoryCsrfToken: vi.fn(),
}))

beforeEach(() => {
  http.apiRequest.mockReset()
  http.apiRequest.mockResolvedValue(undefined)
})

describe('auth account API contracts', () => {
  it('requires password and privacy acceptance when confirming email', async () => {
    const input = {
      userId: '11111111-1111-4111-8111-111111111111',
      token: 'fragment-token',
      newPassword: 'a-long-unique-password',
      privacyPolicyVersion: '2026-07-23' as const,
      importDemoData: true,
      continueWithoutDemoData: false,
    }

    await confirmEmail(input)

    expect(http.apiRequest).toHaveBeenCalledExactlyOnceWith('/api/auth/confirm-email', {
      method: 'POST',
      json: input,
    })
  })

  it('strictly parses active sessions and can revoke one or all other sessions', async () => {
    http.apiRequest.mockResolvedValueOnce([
      {
        sessionId: '22222222-2222-4222-8222-222222222222',
        createdAtUtc: '2026-07-23T10:00:00.000Z',
        lastSeenAtUtc: '2026-07-23T11:00:00.000Z',
        expiresAtUtc: '2026-07-24T10:00:00.000Z',
        current: true,
      },
    ])

    await expect(listAccountSessions()).resolves.toHaveLength(1)
    await revokeAccountSession('33333333-3333-4333-8333-333333333333')
    await revokeOtherAccountSessions()

    expect(http.apiRequest).toHaveBeenNthCalledWith(
      2,
      '/api/account/sessions/33333333-3333-4333-8333-333333333333',
      {
        method: 'DELETE',
      },
    )
    expect(http.apiRequest).toHaveBeenNthCalledWith(3, '/api/account/sessions/others', {
      method: 'DELETE',
    })
  })
})

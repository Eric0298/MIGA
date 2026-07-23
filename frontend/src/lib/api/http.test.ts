import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, resetApiClientForTests, resolveApiUrl } from './http'

describe('same-origin API client', () => {
  beforeEach(() => {
    resetApiClientForTests()
    vi.stubEnv('VITE_API_URL', '/')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('sends cookies and retries exactly once after a csrf_invalid response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ requestToken: 'first-csrf-token-value' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 400, code: 'csrf_invalid' }), {
          status: 400,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ requestToken: 'second-csrf-token-value' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/api/auth/login', {
      method: 'POST',
      json: { email: 'student@example.test', password: 'a-secure-password' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    const firstMutation = fetchMock.mock.calls[1][1]!
    const retriedMutation = fetchMock.mock.calls[3][1]!
    expect(firstMutation.credentials).toBe('include')
    expect(retriedMutation.credentials).toBe('include')
    expect(new Headers(firstMutation.headers).get('X-XSRF-TOKEN')).toBe('first-csrf-token-value')
    expect(new Headers(retriedMutation.headers).get('X-XSRF-TOKEN')).toBe('second-csrf-token-value')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('does not retry a generic 400 response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ requestToken: 'valid-csrf-token-value' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 400, code: 'validation_failed' }), {
          status: 400,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiRequest('/api/auth/login', { method: 'POST', json: {} }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects a configured cross-origin API before making a request', () => {
    vi.stubEnv('VITE_API_URL', 'https://attacker.invalid')
    expect(() => resolveApiUrl('/api/auth/session')).toThrow(/same origin/i)
  })

  it('rejects API base URLs containing credentials or backslashes', () => {
    vi.stubEnv(
      'VITE_API_URL',
      `${window.location.protocol}//user:password@${window.location.host}/`,
    )
    expect(() => resolveApiUrl('/api/auth/session')).toThrow(/same origin/i)

    vi.stubEnv('VITE_API_URL', '/api\\alternate')
    expect(() => resolveApiUrl('/api/auth/session')).toThrow(/backslashes/i)
  })
})

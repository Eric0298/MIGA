import { describe, expect, it } from 'vitest'
import { getAppGuardDecision } from './ProtectedAppRoute'

describe('app guard', () => {
  it('asks for login after account access ends instead of showing an empty local workspace', () => {
    expect(
      getAppGuardDecision({
        status: 'ready',
        authenticated: false,
        hasWorkspace: false,
        requiresLogin: true,
      }),
    ).toBe('login')
    expect(
      getAppGuardDecision({
        status: 'loading',
        authenticated: false,
        hasWorkspace: false,
        requiresLogin: true,
      }),
    ).toBe('loading')
  })

  it('allows the legacy local workspace without authentication', () => {
    expect(
      getAppGuardDecision({
        status: 'ready',
        authenticated: false,
        hasWorkspace: false,
      }),
    ).toBe('allow')
    expect(
      getAppGuardDecision({
        status: 'error',
        authenticated: false,
        hasWorkspace: false,
      }),
    ).toBe('allow')
  })

  it('requires confirmed email and a scoped workspace for authenticated users', () => {
    expect(
      getAppGuardDecision({
        status: 'ready',
        authenticated: true,
        emailConfirmed: false,
        hasWorkspace: true,
      }),
    ).toBe('verify-email')
    expect(
      getAppGuardDecision({
        status: 'ready',
        authenticated: true,
        emailConfirmed: true,
        hasWorkspace: true,
      }),
    ).toBe('allow')
  })
})

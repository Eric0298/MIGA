import { describe, expect, it } from 'vitest'
import { getAppGuardDecision } from './ProtectedAppRoute'

describe('app guard', () => {
  it('requires authentication and confirmed email before allowing the app', () => {
    expect(
      getAppGuardDecision({
        status: 'ready',
        authenticated: false,
        hasWorkspace: false,
      }),
    ).toBe('login')
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

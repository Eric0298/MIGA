import { describe, expect, it } from 'vitest'
import { consumeAuthLinkParameters } from './auth-link'

describe('consumeAuthLinkParameters', () => {
  it('prefers fragment secrets and removes legacy query secrets', () => {
    const result = consumeAuthLinkParameters(
      '#email=student%40example.test&token=fragment-secret',
      '?token=query-secret&campaign=welcome',
      ['email', 'token'],
    )

    expect(result.values).toEqual({
      email: 'student@example.test',
      token: 'fragment-secret',
    })
    expect(result.sanitizedSearch).toBe('?campaign=welcome')
    expect(result.containedSensitiveParameters).toBe(true)
  })
})

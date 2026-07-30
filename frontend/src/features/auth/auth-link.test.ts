import { describe, expect, it } from 'vitest'
import { consumeAuthLinkParameters } from './auth-link'

describe('consumeAuthLinkParameters', () => {
  it('uses fragment secrets and removes rejected query secrets', () => {
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

  it('never accepts a secret delivered only in the query string', () => {
    const result = consumeAuthLinkParameters(
      '',
      '?email=student%40example.test&token=query-secret&campaign=welcome',
      ['email', 'token'],
    )

    expect(result.values).toEqual({})
    expect(result.sanitizedSearch).toBe('?campaign=welcome')
    expect(result.containedSensitiveParameters).toBe(true)
  })
})

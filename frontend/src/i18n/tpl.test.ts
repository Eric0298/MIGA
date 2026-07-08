import { describe, expect, it } from 'vitest'
import { tpl } from './tpl'

describe('tpl', () => {
  it('replaces placeholders', () => {
    expect(tpl('Hola {name}', { name: 'Eric' })).toBe('Hola Eric')
    expect(tpl('{a} + {b} = {c}', { a: 1, b: 2, c: 3 })).toBe('1 + 2 = 3')
  })

  it('supports multiple occurrences of the same placeholder', () => {
    expect(tpl('{x}-{x}', { x: 5 })).toBe('5-5')
  })

  it('returns empty string for missing keys', () => {
    expect(tpl('{a} {b}', { a: 'yes' })).toBe('yes ')
  })

  it('keeps text without placeholders untouched', () => {
    expect(tpl('plain text', {})).toBe('plain text')
  })
})

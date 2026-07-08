import { describe, expect, it } from 'vitest'
import { detectBrowserLanguage } from './detect'

describe('detectBrowserLanguage', () => {
  it('returns en for null or undefined', () => {
    expect(detectBrowserLanguage(null)).toBe('en')
    expect(detectBrowserLanguage(undefined)).toBe('en')
    expect(detectBrowserLanguage('')).toBe('en')
  })

  it('returns es for spanish variants', () => {
    expect(detectBrowserLanguage('es')).toBe('es')
    expect(detectBrowserLanguage('es-ES')).toBe('es')
    expect(detectBrowserLanguage('es-MX')).toBe('es')
    expect(detectBrowserLanguage('ES-es')).toBe('es')
  })

  it('returns va for catalan and valencian variants', () => {
    expect(detectBrowserLanguage('ca')).toBe('va')
    expect(detectBrowserLanguage('ca-ES')).toBe('va')
    expect(detectBrowserLanguage('ca-ES-valencia')).toBe('va')
    expect(detectBrowserLanguage('va')).toBe('va')
    expect(detectBrowserLanguage('va-ES')).toBe('va')
  })

  it('returns en for english variants', () => {
    expect(detectBrowserLanguage('en')).toBe('en')
    expect(detectBrowserLanguage('en-US')).toBe('en')
    expect(detectBrowserLanguage('en-GB')).toBe('en')
  })

  it('returns en for unsupported languages', () => {
    expect(detectBrowserLanguage('fr')).toBe('en')
    expect(detectBrowserLanguage('de-DE')).toBe('en')
    expect(detectBrowserLanguage('ja')).toBe('en')
    expect(detectBrowserLanguage('zh-CN')).toBe('en')
  })
})

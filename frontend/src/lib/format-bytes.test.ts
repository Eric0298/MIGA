import { describe, expect, it } from 'vitest'
import { formatBytes } from './format-bytes'

describe('formatBytes', () => {
  it('renders zero and negative as 0 B', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-10)).toBe('0 B')
  })

  it('keeps small byte values in bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('switches to KB, MB and GB as size grows', () => {
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2 GB')
  })

  it('keeps one decimal for small values in the higher unit', () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })

  it('rounds without decimals once the value reaches 100', () => {
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB')
  })
})

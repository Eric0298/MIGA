import { describe, expect, it } from 'vitest'
import {
  combineHoursMinutes,
  formatDayRelative,
  formatMinutes,
  fromIso,
  getMonthMatrix,
  splitHoursMinutes,
  toIso,
} from './utils'

describe('utils · time', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(0)).toBe('0 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(75)).toBe('1 h 15 min')
    expect(formatMinutes(180)).toBe('3 h')
  })

  it('splits total minutes into hours and minutes', () => {
    expect(splitHoursMinutes(0)).toEqual({ hours: 0, minutes: 0 })
    expect(splitHoursMinutes(90)).toEqual({ hours: 1, minutes: 30 })
    expect(splitHoursMinutes(-5)).toEqual({ hours: 0, minutes: 0 })
  })

  it('combines hours and minutes', () => {
    expect(combineHoursMinutes(1, 30)).toBe(90)
    expect(combineHoursMinutes(0, 0)).toBe(0)
    expect(combineHoursMinutes(-2, 30)).toBe(30)
  })
})

describe('utils · dates', () => {
  it('converts date to ISO and back', () => {
    const iso = '2026-07-15'
    const parsed = fromIso(iso)
    expect(toIso(parsed)).toBe(iso)
  })

  it('formats day relative to today', () => {
    expect(formatDayRelative('2026-07-10', '2026-07-10')).toBe('Hoy')
    expect(formatDayRelative('2026-07-11', '2026-07-10')).toBe('Mañana')
    expect(formatDayRelative('2026-07-09', '2026-07-10')).toBe('Ayer')
    expect(formatDayRelative('2026-07-15', '2026-07-10')).toMatch(/^Mié /)
  })

  it('produces a month matrix with weeks of 7 days starting on Monday', () => {
    const matrix = getMonthMatrix(new Date(2026, 6, 15))
    for (const week of matrix) {
      expect(week).toHaveLength(7)
      expect(week[0].getDay()).toBe(1)
      expect(week[6].getDay()).toBe(0)
    }
    expect(matrix.length).toBeGreaterThanOrEqual(4)
    expect(matrix.length).toBeLessThanOrEqual(6)
  })
})

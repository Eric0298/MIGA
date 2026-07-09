import { describe, expect, it } from 'vitest'
import { mergeRanges, sumRangesSeconds } from './merge-ranges'

describe('mergeRanges', () => {
  it('returns empty for empty input', () => {
    expect(mergeRanges([])).toEqual([])
  })

  it('keeps disjoint intervals as they are, sorted', () => {
    expect(
      mergeRanges([
        [30, 40],
        [0, 10],
      ]),
    ).toEqual([
      [0, 10],
      [30, 40],
    ])
  })

  it('merges overlapping intervals', () => {
    expect(
      mergeRanges([
        [0, 10],
        [5, 20],
        [15, 30],
      ]),
    ).toEqual([[0, 30]])
  })

  it('merges touching intervals', () => {
    expect(
      mergeRanges([
        [0, 10],
        [10, 20],
      ]),
    ).toEqual([[0, 20]])
  })

  it('normalises reversed intervals', () => {
    expect(mergeRanges([[15, 5]])).toEqual([[5, 15]])
  })
})

describe('sumRangesSeconds', () => {
  it('sums disjoint durations', () => {
    expect(
      sumRangesSeconds([
        [0, 10],
        [30, 45],
      ]),
    ).toBe(25)
  })

  it('does not double count overlaps', () => {
    expect(
      sumRangesSeconds([
        [0, 30],
        [10, 40],
      ]),
    ).toBe(40)
  })

  it('handles empty input', () => {
    expect(sumRangesSeconds([])).toBe(0)
  })
})

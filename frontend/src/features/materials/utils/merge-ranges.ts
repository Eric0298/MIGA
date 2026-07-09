import type { VideoRange } from '@/lib/db/schema'

/**
 * Merges overlapping (or touching) intervals into a minimal disjoint set.
 * Input can be unsorted. Output is sorted by start ascending.
 * Invalid ranges (start > end) are normalised by swapping.
 */
export function mergeRanges(ranges: readonly VideoRange[]): VideoRange[] {
  if (ranges.length === 0) return []

  const normalised = ranges
    .map<VideoRange>(([a, b]) => (a <= b ? [a, b] : [b, a]))
    .sort((x, y) => x[0] - y[0])

  const merged: VideoRange[] = [[normalised[0][0], normalised[0][1]]]
  for (let i = 1; i < normalised.length; i++) {
    const [start, end] = normalised[i]
    const last = merged[merged.length - 1]
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

/**
 * Sum of unique seconds covered by the ranges (after mergeing).
 */
export function sumRangesSeconds(ranges: readonly VideoRange[]): number {
  return mergeRanges(ranges).reduce((sum, [start, end]) => sum + (end - start), 0)
}

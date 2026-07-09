import { describe, expect, it } from 'vitest'
import type { MaterialProgress } from '@/lib/db/schema'
import { aggregateMaterialProgress } from './use-material-aggregated-progress'

function makeProgress(overrides: Partial<MaterialProgress>): MaterialProgress {
  const now = 1_700_000_000_000
  return {
    id: crypto.randomUUID(),
    materialId: 'mat-1',
    goalId: null,
    sessionId: null,
    kind: 'video-youtube',
    totalWatchedMs: 0,
    startedAt: now,
    endedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('aggregateMaterialProgress', () => {
  it('returns zero and empty state when there are no rows', () => {
    const result = aggregateMaterialProgress([])
    expect(result.resumeSeconds).toBe(0)
    expect(result.pagesReadCounts).toEqual({})
  })

  it('resumes from the last range of the most recent row with ranges', () => {
    const older = makeProgress({
      endedAt: 1_000,
      videoRanges: [
        [0, 30],
        [50, 90],
      ],
    })
    const newer = makeProgress({
      endedAt: 2_000,
      videoRanges: [[100, 130]],
    })
    const other = makeProgress({
      endedAt: 3_000,
      videoRanges: undefined,
      kind: 'pdf',
    })
    const result = aggregateMaterialProgress([other, older, newer])
    expect(result.resumeSeconds).toBe(130)
  })

  it('sums per-page read counts across all rows', () => {
    const rows: MaterialProgress[] = [
      makeProgress({ kind: 'pdf', pagesReadCounts: { '3': 2, '5': 1 } }),
      makeProgress({ kind: 'pdf', pagesReadCounts: { '3': 1, '7': 4 } }),
    ]
    const result = aggregateMaterialProgress(rows)
    expect(result.pagesReadCounts).toEqual({ 3: 3, 5: 1, 7: 4 })
  })

  it('treats legacy pagesRead as count = 1 per listed page when counts are absent', () => {
    const rows: MaterialProgress[] = [
      makeProgress({ kind: 'pdf', pagesRead: [1, 4] }),
      makeProgress({ kind: 'pdf', pagesReadCounts: { '4': 2 } }),
    ]
    const result = aggregateMaterialProgress(rows)
    expect(result.pagesReadCounts).toEqual({ 1: 1, 4: 3 })
  })
})

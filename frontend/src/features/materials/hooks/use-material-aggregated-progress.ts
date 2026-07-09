import { useLiveQuery } from 'dexie-react-hooks'
import { listProgressByMaterial } from '@/lib/db/material-progress.repository'
import type { MaterialProgress } from '@/lib/db/schema'

export type MaterialAggregatedProgress = {
  /** Seconds where the tracker left off in the most recent session with
   *  ranges. Used to resume video playback. 0 if no prior watched time. */
  resumeSeconds: number
  /** Sum of per-page read counts across every prior MaterialProgress row.
   *  Empty object if no prior page marks. */
  pagesReadCounts: Record<number, number>
}

/**
 * Live-aggregates the persisted MaterialProgress rows for a material into
 * the state a viewer needs to "resume": the last watched position for
 * videos and the per-page read counter for PDFs.
 */
export function useMaterialAggregatedProgress(
  materialId: string | null | undefined,
): MaterialAggregatedProgress | undefined {
  return useLiveQuery(async () => {
    if (!materialId) {
      return { resumeSeconds: 0, pagesReadCounts: {} } satisfies MaterialAggregatedProgress
    }
    const rows = await listProgressByMaterial(materialId)
    return aggregate(rows)
  }, [materialId])
}

export function aggregateMaterialProgress(
  rows: MaterialProgress[],
): MaterialAggregatedProgress {
  return aggregate(rows)
}

function aggregate(rows: MaterialProgress[]): MaterialAggregatedProgress {
  let mostRecentRow: MaterialProgress | null = null
  const pagesReadCounts: Record<number, number> = {}

  for (const row of rows) {
    // Track the row with the most recent activity that has video ranges,
    // so we can resume where the user left off last time.
    if (row.videoRanges && row.videoRanges.length > 0) {
      const rowEnd = row.endedAt ?? row.updatedAt
      const bestEnd = mostRecentRow ? (mostRecentRow.endedAt ?? mostRecentRow.updatedAt) : -1
      if (rowEnd > bestEnd) mostRecentRow = row
    }
    // Sum per-page read counts. Fall back to pagesRead (count = 1 per page)
    // for rows that predate the counts field.
    if (row.pagesReadCounts) {
      for (const [pageStr, count] of Object.entries(row.pagesReadCounts)) {
        const page = Number.parseInt(pageStr, 10)
        if (!Number.isFinite(page)) continue
        pagesReadCounts[page] = (pagesReadCounts[page] ?? 0) + count
      }
    } else if (row.pagesRead) {
      for (const page of row.pagesRead) {
        pagesReadCounts[page] = (pagesReadCounts[page] ?? 0) + 1
      }
    }
  }

  const resumeSeconds = mostRecentRow?.videoRanges
    ? mostRecentRow.videoRanges[mostRecentRow.videoRanges.length - 1][1]
    : 0

  return { resumeSeconds, pagesReadCounts }
}

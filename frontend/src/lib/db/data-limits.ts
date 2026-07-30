export const MAX_HTTP_URL_CHARS = 2_048
export const MAX_SNAPSHOT_UTF8_BYTES = 5 * 1024 * 1024

export const SNAPSHOT_LIMITS = {
  goals: 500,
  sessions: 20_000,
  materials: 5_000,
  materialGoalLinks: 20_000,
  materialProgress: 50_000,
  notes: 5_000,
  questions: 10_000,
  examAttempts: 10_000,
  scheduledDaysPerGoal: 3_660,
  materialsPerSession: 500,
  goalsPerNote: 100,
  videoRangesPerProgress: 10_000,
  pagesPerProgress: 10_000,
  questionsPerExam: 500,
  responsesPerExam: 500,
} as const

export class SnapshotSizeLimitError extends Error {
  readonly actualBytes: number

  constructor(actualBytes: number) {
    super(`Snapshot exceeds the ${MAX_SNAPSHOT_UTF8_BYTES} byte limit`)
    this.name = 'SnapshotSizeLimitError'
    this.actualBytes = actualBytes
  }
}

export function snapshotUtf8Size(payload: unknown): number {
  return new TextEncoder().encode(JSON.stringify(payload)).byteLength
}

export function assertSnapshotSize(payload: unknown): void {
  const actualBytes = snapshotUtf8Size(payload)
  if (actualBytes > MAX_SNAPSHOT_UTF8_BYTES) {
    throw new SnapshotSizeLimitError(actualBytes)
  }
}

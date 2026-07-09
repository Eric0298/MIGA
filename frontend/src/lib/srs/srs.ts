import type { Question, QuestionReviewState } from '@/lib/db/schema'

const CORRECT_MULTIPLIER = 0.7
const INCORRECT_MULTIPLIER = 1.5
const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 10
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Returns the review state after answering a question. Correct answers decay
 * the weight (question shown less), incorrect answers grow it (shown more),
 * both clamped to [WEIGHT_MIN, WEIGHT_MAX].
 *
 * Pure, deterministic and easy to unit test.
 */
export function updateReviewState(
  state: QuestionReviewState,
  isCorrect: boolean,
  now: number = Date.now(),
): QuestionReviewState {
  const multiplier = isCorrect ? CORRECT_MULTIPLIER : INCORRECT_MULTIPLIER
  const nextWeight = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, state.weight * multiplier))
  return {
    timesSeen: state.timesSeen + 1,
    timesCorrect: state.timesCorrect + (isCorrect ? 1 : 0),
    timesIncorrect: state.timesIncorrect + (isCorrect ? 0 : 1),
    lastSeenAt: now,
    weight: nextWeight,
  }
}

/**
 * Effective weight for the picker: base weight boosted by how long ago the
 * question was last seen, so items you haven't touched in a while resurface.
 */
export function effectiveWeight(state: QuestionReviewState, now: number = Date.now()): number {
  const daysSinceLastSeen =
    state.lastSeenAt === null
      ? 30 // never seen → treat as "old" so new questions surface early
      : Math.max(0, (now - state.lastSeenAt) / DAY_MS)
  return state.weight * (1 + Math.log1p(daysSinceLastSeen))
}

/**
 * Weighted-random pick of the next question. Optionally excludes questions
 * whose id is in `excludeIds` (typically the ids you just showed in a row).
 * Falls back to a linear index if the RNG returns exactly totalWeight.
 */
export function pickNextQuestion(
  questions: Question[],
  options: {
    excludeIds?: readonly string[]
    now?: number
    random?: () => number
  } = {},
): Question | null {
  const now = options.now ?? Date.now()
  const random = options.random ?? Math.random
  const exclude = new Set(options.excludeIds ?? [])
  const pool = questions.filter((q) => !exclude.has(q.id))
  if (pool.length === 0) return null
  const weights = pool.map((q) => effectiveWeight(q.reviewState, now))
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  if (totalWeight <= 0) return pool[0]
  const target = random() * totalWeight
  let cum = 0
  for (let i = 0; i < pool.length; i++) {
    cum += weights[i]
    if (cum >= target) return pool[i]
  }
  return pool[pool.length - 1]
}

/** Fisher–Yates in-place shuffle, taking a random source for tests. */
export function shuffle<T>(array: readonly T[], random: () => number = Math.random): T[] {
  const copy = array.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Compares a user's chosen answer ids against a question's correct set. Only
 * a full match (every correct chosen, no incorrect chosen) counts.
 */
export function isAnswerCorrect(
  question: Question,
  chosenAnswerIds: readonly string[],
): boolean {
  const correctIds = new Set(question.answers.filter((a) => a.isCorrect).map((a) => a.id))
  const chosen = new Set(chosenAnswerIds)
  if (correctIds.size !== chosen.size) return false
  for (const id of correctIds) {
    if (!chosen.has(id)) return false
  }
  return true
}

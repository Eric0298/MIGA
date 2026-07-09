import { describe, expect, it } from 'vitest'
import type { Question, QuestionReviewState } from '@/lib/db/schema'
import {
  effectiveWeight,
  isAnswerCorrect,
  pickNextQuestion,
  shuffle,
  updateReviewState,
} from './srs'

function makeState(overrides: Partial<QuestionReviewState> = {}): QuestionReviewState {
  return {
    timesSeen: 0,
    timesCorrect: 0,
    timesIncorrect: 0,
    lastSeenAt: null,
    weight: 1,
    ...overrides,
  }
}

function makeQuestion(
  overrides: Partial<Question> = {},
  state: Partial<QuestionReviewState> = {},
): Question {
  const now = 1_700_000_000_000
  return {
    id: crypto.randomUUID(),
    goalId: 'goal-1',
    prompt: '¿Cuál?',
    answers: [
      { id: 'a', text: 'A', isCorrect: true },
      { id: 'b', text: 'B', isCorrect: false },
    ],
    reviewState: makeState(state),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('updateReviewState', () => {
  const NOW = 1_700_000_000_000
  it('increments timesSeen and timesCorrect on a correct answer', () => {
    const next = updateReviewState(makeState({ weight: 1 }), true, NOW)
    expect(next.timesSeen).toBe(1)
    expect(next.timesCorrect).toBe(1)
    expect(next.timesIncorrect).toBe(0)
    expect(next.lastSeenAt).toBe(NOW)
    expect(next.weight).toBeCloseTo(0.7)
  })

  it('increments timesIncorrect on a wrong answer and grows weight', () => {
    const next = updateReviewState(makeState({ weight: 1 }), false, NOW)
    expect(next.timesIncorrect).toBe(1)
    expect(next.weight).toBeCloseTo(1.5)
  })

  it('clamps the weight to the [0.1, 10] range', () => {
    const low = updateReviewState(makeState({ weight: 0.11 }), true, NOW)
    expect(low.weight).toBeGreaterThanOrEqual(0.1)
    const high = updateReviewState(makeState({ weight: 8 }), false, NOW)
    expect(high.weight).toBeLessThanOrEqual(10)
  })
})

describe('effectiveWeight', () => {
  const NOW = 1_700_000_000_000
  it('treats never-seen questions as somewhat aged so they can surface', () => {
    const w = effectiveWeight(makeState({ weight: 1, lastSeenAt: null }), NOW)
    expect(w).toBeGreaterThan(1)
  })
  it('grows with the time elapsed since the last review', () => {
    const day = 24 * 60 * 60 * 1000
    const recent = effectiveWeight(makeState({ weight: 1, lastSeenAt: NOW - day }), NOW)
    const older = effectiveWeight(makeState({ weight: 1, lastSeenAt: NOW - 10 * day }), NOW)
    expect(older).toBeGreaterThan(recent)
  })
})

describe('pickNextQuestion', () => {
  it('returns null when the pool is empty', () => {
    expect(pickNextQuestion([])).toBeNull()
  })

  it('excludes ids listed in options.excludeIds', () => {
    const q1 = makeQuestion({ id: 'q1' })
    const q2 = makeQuestion({ id: 'q2' })
    const picked = pickNextQuestion([q1, q2], { excludeIds: ['q1'], random: () => 0.5 })
    expect(picked?.id).toBe('q2')
  })

  it('picks a heavier question more often with a deterministic RNG', () => {
    const easy = makeQuestion({ id: 'easy' }, { weight: 0.2, lastSeenAt: 1 })
    const hard = makeQuestion({ id: 'hard' }, { weight: 5, lastSeenAt: 1 })
    // With random() = 0 we sample the very first slice, which is `easy` (order
    // in the array). With random() = 0.5, cumulative weight lands inside the
    // `hard` slice because it's much larger.
    const first = pickNextQuestion([easy, hard], { random: () => 0, now: 1 })
    expect(first?.id).toBe('easy')
    const middle = pickNextQuestion([easy, hard], { random: () => 0.5, now: 1 })
    expect(middle?.id).toBe('hard')
  })
})

describe('shuffle', () => {
  it('keeps every element (no duplicates, no losses)', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input, () => 0.5)
    expect(out.slice().sort()).toEqual(input)
  })
})

describe('isAnswerCorrect', () => {
  const q = makeQuestion({
    answers: [
      { id: 'a', text: 'A', isCorrect: true },
      { id: 'b', text: 'B', isCorrect: false },
      { id: 'c', text: 'C', isCorrect: true },
    ],
  })
  it('is true when the chosen ids exactly match the correct set', () => {
    expect(isAnswerCorrect(q, ['a', 'c'])).toBe(true)
    expect(isAnswerCorrect(q, ['c', 'a'])).toBe(true) // order-insensitive
  })
  it('is false when a correct is missing', () => {
    expect(isAnswerCorrect(q, ['a'])).toBe(false)
  })
  it('is false when an incorrect is included', () => {
    expect(isAnswerCorrect(q, ['a', 'b', 'c'])).toBe(false)
  })
  it('is false when nothing is chosen', () => {
    expect(isAnswerCorrect(q, [])).toBe(false)
  })
})

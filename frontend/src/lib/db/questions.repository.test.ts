import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import {
  createQuestion,
  deleteQuestion,
  deleteQuestionsByGoal,
  getQuestion,
  INITIAL_REVIEW_STATE,
  listQuestionsByGoal,
  replaceReviewState,
  updateQuestion,
} from './questions.repository'
import { putQuestionBlob } from './question-blobs.repository'
import { updateReviewState } from '@/lib/srs/srs'

const GOAL_A = crypto.randomUUID()
const GOAL_B = crypto.randomUUID()

afterEach(async () => {
  await db.questions.clear()
  await db.questionBlobs.clear()
})

describe('questions repository', () => {
  it('creates a question with generated answer ids and initial review state', async () => {
    const q = await createQuestion({
      goalId: GOAL_A,
      prompt: '¿Qué es MIGA?',
      answers: [
        { text: 'Un patrón', isCorrect: false },
        { text: 'Una PWA', isCorrect: true },
      ],
    })
    expect(q.id).toBeTypeOf('string')
    expect(q.answers).toHaveLength(2)
    expect(q.answers.every((a) => typeof a.id === 'string' && a.id.length > 0)).toBe(true)
    expect(q.reviewState).toEqual(INITIAL_REVIEW_STATE)
  })

  it('rejects a question without any correct answer', async () => {
    await expect(
      createQuestion({
        goalId: GOAL_A,
        prompt: 'p',
        answers: [
          { text: 'a', isCorrect: false },
          { text: 'b', isCorrect: false },
        ],
      }),
    ).rejects.toThrow()
  })

  it('rejects a question with fewer than two answers', async () => {
    await expect(
      createQuestion({
        goalId: GOAL_A,
        prompt: 'p',
        answers: [{ text: 'a', isCorrect: true }],
      }),
    ).rejects.toThrow()
  })

  it('lists questions of a goal (ignores other goals)', async () => {
    await createQuestion({
      goalId: GOAL_A,
      prompt: 'p1',
      answers: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    })
    await createQuestion({
      goalId: GOAL_B,
      prompt: 'p2',
      answers: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    })
    const list = await listQuestionsByGoal(GOAL_A)
    expect(list).toHaveLength(1)
    expect(list[0].prompt).toBe('p1')
  })

  it('updates prompt and answers, keeps ids stable and bumps updatedAt', async () => {
    const created = await createQuestion({
      goalId: GOAL_A,
      prompt: 'p',
      answers: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    })
    const initialAnswers = created.answers.map((a) => a.id)
    await new Promise((r) => setTimeout(r, 5))
    await updateQuestion(created.id, {
      prompt: 'nuevo',
      answers: [
        { id: initialAnswers[0], text: 'A', isCorrect: true },
        { id: initialAnswers[1], text: 'B', isCorrect: false },
      ],
    })
    const updated = await getQuestion(created.id)
    expect(updated?.prompt).toBe('nuevo')
    expect(updated?.answers[0].id).toBe(initialAnswers[0])
    expect(updated!.updatedAt).toBeGreaterThan(created.updatedAt)
  })

  it('replaces review state (SRS bookkeeping)', async () => {
    const q = await createQuestion({
      goalId: GOAL_A,
      prompt: 'p',
      answers: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    })
    const next = updateReviewState(q.reviewState, false, 42)
    await replaceReviewState(q.id, next)
    const reloaded = await getQuestion(q.id)
    expect(reloaded?.reviewState.timesIncorrect).toBe(1)
    expect(reloaded?.reviewState.weight).toBeGreaterThan(1)
  })

  it('deletes a question and its attached blobs', async () => {
    const blob = await putQuestionBlob({
      blob: new Blob(['x'], { type: 'image/png' }),
      kind: 'image',
    })
    const q = await createQuestion({
      goalId: GOAL_A,
      prompt: 'p',
      imageBlobKey: blob.id,
      answers: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    })
    await db.questionBlobs.update(blob.id, { questionId: q.id })
    await deleteQuestion(q.id)
    expect(await getQuestion(q.id)).toBeNull()
    expect(await db.questionBlobs.get(blob.id)).toBeUndefined()
  })

  it('deletes every question of a goal at once', async () => {
    await createQuestion({
      goalId: GOAL_A,
      prompt: 'p1',
      answers: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    })
    await createQuestion({
      goalId: GOAL_A,
      prompt: 'p2',
      answers: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    })
    await createQuestion({
      goalId: GOAL_B,
      prompt: 'other',
      answers: [
        { text: 'a', isCorrect: true },
        { text: 'b', isCorrect: false },
      ],
    })
    await deleteQuestionsByGoal(GOAL_A)
    expect((await listQuestionsByGoal(GOAL_A)).length).toBe(0)
    expect((await listQuestionsByGoal(GOAL_B)).length).toBe(1)
  })
})

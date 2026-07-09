import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import {
  deleteExamAttempt,
  deleteExamAttemptsByGoal,
  discardExamAttempt,
  finishPdfExamAttempt,
  finishQuestionsExamAttempt,
  getExamAttempt,
  getExamElapsedMs,
  gradePdfExamAttempt,
  listExamAttemptsByGoal,
  pauseExamAttempt,
  resumeExamAttempt,
  startPdfExamAttempt,
  startQuestionsExamAttempt,
} from './exam-attempts.repository'

const GOAL_A = crypto.randomUUID()
const GOAL_B = crypto.randomUUID()

afterEach(async () => {
  await db.examAttempts.clear()
})

describe('exam attempts — pdf', () => {
  it('starts an in-progress attempt with a pdf reference', async () => {
    const attempt = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'Modelo 2024',
      pdfMaterialId: 'mat-1',
    })
    expect(attempt.kind).toBe('pdf')
    expect(attempt.status).toBe('in-progress')
    expect(attempt.pdfMaterialId).toBe('mat-1')
    expect(attempt.score).toBeNull()
  })

  it('rejects a pdf attempt without any pdf source', async () => {
    await expect(
      startPdfExamAttempt({ goalId: GOAL_A, title: 'x' }),
    ).rejects.toThrow()
  })

  it('finishes with a score → status graded and stores the score', async () => {
    const a = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'x',
      pdfMaterialId: 'mat-1',
    })
    await finishPdfExamAttempt(a.id, { score: 7.5, maxScore: 10, notes: 'meh' })
    const reloaded = await getExamAttempt(a.id)
    expect(reloaded?.status).toBe('graded')
    expect(reloaded?.score).toBe(7.5)
    expect(reloaded?.maxScore).toBe(10)
    expect(reloaded?.notes).toBe('meh')
    expect(reloaded?.endedAt).not.toBeNull()
  })

  it('finishes without a score → status pending-grade', async () => {
    const a = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'x',
      pdfMaterialId: 'mat-1',
    })
    await finishPdfExamAttempt(a.id, { score: null, maxScore: null })
    const reloaded = await getExamAttempt(a.id)
    expect(reloaded?.status).toBe('pending-grade')
    expect(reloaded?.score).toBeNull()
  })

  it('grades a previously pending attempt', async () => {
    const a = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'x',
      pdfMaterialId: 'mat-1',
    })
    await finishPdfExamAttempt(a.id, { score: null, maxScore: null })
    await gradePdfExamAttempt(a.id, 8, 10)
    const reloaded = await getExamAttempt(a.id)
    expect(reloaded?.status).toBe('graded')
    expect(reloaded?.score).toBe(8)
  })

  it('pause/resume accumulates totalPausedMs', async () => {
    const a = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'x',
      pdfMaterialId: 'mat-1',
    })
    await pauseExamAttempt(a.id)
    await new Promise((r) => setTimeout(r, 15))
    await resumeExamAttempt(a.id)
    const reloaded = await getExamAttempt(a.id)
    expect(reloaded?.status).toBe('in-progress')
    expect(reloaded?.totalPausedMs).toBeGreaterThan(0)
  })
})

describe('exam attempts — questions', () => {
  it('starts and finishes a questions attempt with auto score', async () => {
    const a = await startQuestionsExamAttempt({
      goalId: GOAL_A,
      title: 'test1',
      questionIds: ['q1', 'q2', 'q3'],
    })
    expect(a.kind).toBe('questions')
    expect(a.maxScore).toBe(3)

    await finishQuestionsExamAttempt(a.id, {
      responses: [
        { questionId: 'q1', chosenAnswerIds: ['a1'], isCorrect: true, answeredAt: 1 },
        { questionId: 'q2', chosenAnswerIds: ['b1'], isCorrect: false, answeredAt: 2 },
        { questionId: 'q3', chosenAnswerIds: ['c1'], isCorrect: true, answeredAt: 3 },
      ],
      notes: 'quick',
    })
    const reloaded = await getExamAttempt(a.id)
    expect(reloaded?.status).toBe('completed')
    expect(reloaded?.score).toBe(2)
    expect(reloaded?.maxScore).toBe(3)
    expect(reloaded?.responses).toHaveLength(3)
    expect(reloaded?.notes).toBe('quick')
  })

  it('rejects starting an attempt with zero questions', async () => {
    await expect(
      startQuestionsExamAttempt({ goalId: GOAL_A, title: 'x', questionIds: [] }),
    ).rejects.toThrow()
  })
})

describe('exam attempts — housekeeping', () => {
  it('lists attempts of a goal (most recent first)', async () => {
    const a = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'A',
      pdfMaterialId: 'mat-1',
    })
    await new Promise((r) => setTimeout(r, 5))
    const b = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'B',
      pdfMaterialId: 'mat-1',
    })
    await startPdfExamAttempt({
      goalId: GOAL_B,
      title: 'other',
      pdfMaterialId: 'mat-1',
    })
    const list = await listExamAttemptsByGoal(GOAL_A)
    expect(list.map((x) => x.id)).toEqual([b.id, a.id])
  })

  it('discards an attempt', async () => {
    const a = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'x',
      pdfMaterialId: 'mat-1',
    })
    await discardExamAttempt(a.id)
    const reloaded = await getExamAttempt(a.id)
    expect(reloaded?.status).toBe('discarded')
  })

  it('deletes attempts of a goal in bulk', async () => {
    await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'A',
      pdfMaterialId: 'mat-1',
    })
    await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'B',
      pdfMaterialId: 'mat-1',
    })
    await startPdfExamAttempt({
      goalId: GOAL_B,
      title: 'C',
      pdfMaterialId: 'mat-1',
    })
    await deleteExamAttemptsByGoal(GOAL_A)
    expect((await listExamAttemptsByGoal(GOAL_A)).length).toBe(0)
    expect((await listExamAttemptsByGoal(GOAL_B)).length).toBe(1)
  })

  it('deletes a single attempt', async () => {
    const a = await startPdfExamAttempt({
      goalId: GOAL_A,
      title: 'x',
      pdfMaterialId: 'mat-1',
    })
    await deleteExamAttempt(a.id)
    expect(await getExamAttempt(a.id)).toBeNull()
  })
})

describe('getExamElapsedMs', () => {
  it('is 0 for a discarded attempt', () => {
    const now = 100_000
    const attempt = {
      id: 'x',
      goalId: 'g',
      kind: 'pdf' as const,
      title: 't',
      startedAt: 0,
      pausedAt: null,
      endedAt: 30_000,
      totalPausedMs: 0,
      status: 'discarded' as const,
      timeLimitMs: null,
      score: null,
      maxScore: null,
      notes: '',
      createdAt: 0,
      updatedAt: 0,
    }
    expect(getExamElapsedMs(attempt, now)).toBe(0)
  })

  it('subtracts totalPausedMs on a finished attempt', () => {
    const attempt = {
      id: 'x',
      goalId: 'g',
      kind: 'pdf' as const,
      title: 't',
      startedAt: 0,
      pausedAt: null,
      endedAt: 60_000,
      totalPausedMs: 10_000,
      status: 'graded' as const,
      timeLimitMs: null,
      score: 8,
      maxScore: 10,
      notes: '',
      createdAt: 0,
      updatedAt: 0,
    }
    expect(getExamElapsedMs(attempt)).toBe(50_000)
  })
})

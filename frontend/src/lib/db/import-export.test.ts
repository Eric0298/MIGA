import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import { createGoal, deleteGoal } from './goals.repository'
import { startSession, stopSession } from './sessions.repository'
import { attachMaterialToGoal, createMaterial, listMaterialsByGoal } from './materials.repository'
import { createNote, listNotesByGoal } from './notes.repository'
import { createQuestion, listQuestionsByGoal } from './questions.repository'
import {
  finishQuestionsExamAttempt,
  listExamAttemptsByGoal,
  startQuestionsExamAttempt,
} from './exam-attempts.repository'
import {
  buildExportPayload,
  clearAllData,
  CURRENT_EXPORT_VERSION,
  importAllData,
  parseImportPayload,
} from './import-export'

afterEach(async () => {
  await db.goals.clear()
  await db.sessions.clear()
  await db.materials.clear()
  await db.materialGoalLinks.clear()
  await db.materialProgress.clear()
  await db.notes.clear()
  await db.questions.clear()
  await db.examAttempts.clear()
})

describe('import-export v6', () => {
  it('builds an export payload with current goals, sessions, materials and links', async () => {
    const goal = await createGoal({
      name: 'Estudiar',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    const s = await startSession({ goalId: null })
    await stopSession(s.id)
    await createMaterial(
      {
        kind: 'link',
        title: 'React Docs',
        url: 'https://react.dev',
        metadata: {},
      },
      [goal.id],
    )

    const payload = await buildExportPayload()
    expect(payload.version).toBe(CURRENT_EXPORT_VERSION)
    expect(payload.goals).toHaveLength(1)
    expect(payload.sessions).toHaveLength(1)
    expect(payload.materials).toHaveLength(1)
    expect(payload.materialGoalLinks).toHaveLength(1)
    expect(payload.exportedAt).toBeGreaterThan(0)
  })

  it('rejects an invalid payload', () => {
    expect(() => parseImportPayload({ version: 99, goals: [], sessions: [] })).toThrow()
    expect(() => parseImportPayload({ version: 1 })).toThrow()
    expect(() => parseImportPayload(null)).toThrow()
  })

  it('imports a legacy v1 payload with empty materials', async () => {
    const now = Date.now()
    const parsed = parseImportPayload({
      version: 1,
      exportedAt: now,
      goals: [
        {
          id: 'goal-1',
          name: 'Legacy',
          targetMinutes: 60,
          scheduledDays: ['2026-07-10'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      sessions: [],
    })
    expect(parsed.version).toBe(6)
    expect(parsed.materials).toEqual([])
    expect(parsed.materialGoalLinks).toEqual([])
    expect(parsed.materialProgress).toEqual([])
    expect(parsed.notes).toEqual([])
    expect(parsed.questions).toEqual([])
    expect(parsed.examAttempts).toEqual([])
    for (const s of parsed.sessions) expect(Array.isArray(s.materialIds)).toBe(true)

    const result = await importAllData(parsed)
    expect(result.goalsCount).toBe(1)
    expect(result.materialsCount).toBe(0)
    expect(result.linksCount).toBe(0)
    expect(result.progressCount).toBe(0)
    expect(result.notesCount).toBe(0)
    expect(result.questionsCount).toBe(0)
    expect(result.examAttemptsCount).toBe(0)
  })

  it('migrates a v4 payload adding empty notes, questions and examAttempts', async () => {
    const now = Date.now()
    const parsed = parseImportPayload({
      version: 4,
      exportedAt: now,
      goals: [],
      sessions: [],
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
    })
    expect(parsed.version).toBe(6)
    expect(parsed.notes).toEqual([])
    expect(parsed.questions).toEqual([])
    expect(parsed.examAttempts).toEqual([])
  })

  it('migrates a v5 payload adding empty questions and examAttempts', async () => {
    const now = Date.now()
    const parsed = parseImportPayload({
      version: 5,
      exportedAt: now,
      goals: [],
      sessions: [],
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
      notes: [],
    })
    expect(parsed.version).toBe(6)
    expect(parsed.questions).toEqual([])
    expect(parsed.examAttempts).toEqual([])
  })

  it('migrates a v3 payload wrapping materialId in materialIds', async () => {
    const now = Date.now()
    const parsed = parseImportPayload({
      version: 3,
      exportedAt: now,
      goals: [],
      sessions: [
        {
          id: 'sess-1',
          goalId: null,
          materialId: 'mat-abc',
          startedAt: now,
          pausedAt: null,
          endedAt: now + 1_000,
          totalPausedMs: 0,
          status: 'completed',
          createdAt: now,
          updatedAt: now,
        },
      ],
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
    })
    expect(parsed.version).toBe(6)
    expect(parsed.sessions).toHaveLength(1)
    expect(parsed.sessions[0].materialIds).toEqual(['mat-abc'])
    expect(parsed.notes).toEqual([])
    expect(parsed.questions).toEqual([])
    expect(parsed.examAttempts).toEqual([])
  })

  it('completes a v2 round trip including materials', async () => {
    const goal = await createGoal({
      name: 'Meta A',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    await createMaterial(
      {
        kind: 'note',
        title: 'Ideas',
        notes: 'Repasar capítulo 2',
        metadata: {},
      },
      [goal.id],
    )
    const s = await startSession({ goalId: null })
    await stopSession(s.id)

    const payload = await buildExportPayload()
    await clearAllData()
    expect(await db.materials.count()).toBe(0)
    expect(await db.materialGoalLinks.count()).toBe(0)

    const result = await importAllData(payload)
    expect(result.goalsCount).toBe(1)
    expect(result.materialsCount).toBe(1)
    expect(result.linksCount).toBe(1)
    expect(await db.materials.count()).toBe(1)
    expect(await db.materialGoalLinks.count()).toBe(1)
  })

  it('normalizes running sessions to completed on import', async () => {
    const now = Date.now()
    const parsed = parseImportPayload({
      version: 1,
      exportedAt: now,
      goals: [],
      sessions: [
        {
          id: 'sess-1',
          goalId: null,
          startedAt: now - 60_000,
          pausedAt: null,
          endedAt: null,
          totalPausedMs: 0,
          status: 'running',
          createdAt: now - 60_000,
          updatedAt: now - 60_000,
        },
      ],
    })
    const result = await importAllData(parsed)
    expect(result.normalizedActiveSessions).toBe(1)

    const saved = await db.sessions.get('sess-1')
    expect(saved?.status).toBe('completed')
    expect(saved?.endedAt).not.toBeNull()
  })

  it('clearAllData empties every store', async () => {
    const goal = await createGoal({
      name: 'Meta A',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    await createMaterial({ kind: 'link', title: 'Doc', url: 'https://example.org', metadata: {} }, [
      goal.id,
    ])
    const s = await startSession({ goalId: null })
    await stopSession(s.id)

    await clearAllData()
    expect(await db.goals.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)
    expect(await db.materials.count()).toBe(0)
    expect(await db.materialGoalLinks.count()).toBe(0)
  })

  it('round-trips questions and exam attempts of a goal', async () => {
    const goal = await createGoal({
      name: 'Meta con preguntas',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    const q = await createQuestion({
      goalId: goal.id,
      prompt: '¿Cuál?',
      answers: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    })
    const attempt = await startQuestionsExamAttempt({
      goalId: goal.id,
      title: 'test',
      questionIds: [q.id],
    })
    await finishQuestionsExamAttempt(attempt.id, {
      responses: [
        {
          questionId: q.id,
          chosenAnswerIds: [q.answers[0].id],
          isCorrect: true,
          answeredAt: Date.now(),
        },
      ],
    })

    const payload = await buildExportPayload()
    expect(payload.questions).toHaveLength(1)
    expect(payload.examAttempts).toHaveLength(1)

    await clearAllData()
    expect(await db.questions.count()).toBe(0)
    expect(await db.examAttempts.count()).toBe(0)

    const result = await importAllData(payload)
    expect(result.questionsCount).toBe(1)
    expect(result.examAttemptsCount).toBe(1)
    const restoredQs = await listQuestionsByGoal(goal.id)
    expect(restoredQs).toHaveLength(1)
    expect(restoredQs[0].answers[0].text).toBe('A')
    const restoredExams = await listExamAttemptsByGoal(goal.id)
    expect(restoredExams).toHaveLength(1)
    expect(restoredExams[0].status).toBe('completed')
    expect(restoredExams[0].score).toBe(1)
  })

  it('round-trips notes attached to a goal', async () => {
    const goal = await createGoal({
      name: 'Meta con apuntes',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    await createNote({
      goalId: goal.id,
      kind: 'text',
      title: 'Ideas',
      text: 'Repasar hoy',
    })
    await createNote({
      goalId: goal.id,
      kind: 'text',
      title: 'Duda',
      text: 'Revisar el ejercicio 4',
    })

    const payload = await buildExportPayload()
    expect(payload.notes).toHaveLength(2)

    await clearAllData()
    expect(await db.notes.count()).toBe(0)

    const result = await importAllData(payload)
    expect(result.notesCount).toBe(2)
    const restored = await listNotesByGoal(goal.id)
    expect(restored).toHaveLength(2)
    expect(restored.map((n) => n.title).sort()).toEqual(['Duda', 'Ideas'])
  })

  it('deleting a goal cascades notes and material links but keeps the material', async () => {
    const goalA = await createGoal({
      name: 'Meta A',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    const goalB = await createGoal({
      name: 'Meta B',
      targetMinutes: 60,
      scheduledDays: ['2026-07-11'],
    })
    const material = await createMaterial(
      { kind: 'link', title: 'Doc', url: 'https://example.org', metadata: {} },
      [goalA.id],
    )
    await attachMaterialToGoal(material.id, goalB.id)
    await createNote({ goalId: goalA.id, kind: 'text', title: 'A', text: 'x' })
    await createNote({ goalId: goalB.id, kind: 'text', title: 'B', text: 'x' })

    await deleteGoal(goalA.id)
    const remainingLinks = await db.materialGoalLinks.toArray()
    expect(remainingLinks).toHaveLength(1)
    expect(remainingLinks[0].goalId).toBe(goalB.id)
    expect(await db.materials.count()).toBe(1)

    const forB = await listMaterialsByGoal(goalB.id)
    expect(forB).toHaveLength(1)
    expect(forB[0].id).toBe(material.id)

    // notes of goalA are gone, notes of goalB are kept
    expect((await listNotesByGoal(goalA.id)).length).toBe(0)
    expect((await listNotesByGoal(goalB.id)).length).toBe(1)
  })
})

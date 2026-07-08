import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import {
  deleteSession,
  discardSession,
  getActiveSession,
  listCompletedSessions,
  pauseSession,
  resumeSession,
  startSession,
  stopSession,
} from './sessions.repository'

afterEach(async () => {
  await db.sessions.clear()
})

describe('sessions repository · lifecycle', () => {
  it('starts a new session with no active one', async () => {
    const session = await startSession({ goalId: null })
    expect(session.status).toBe('running')
    expect(session.pausedAt).toBeNull()
    expect(session.endedAt).toBeNull()
  })

  it('rejects a second start while one is active', async () => {
    await startSession({ goalId: null })
    await expect(startSession({ goalId: null })).rejects.toBeDefined()
  })

  it('pauses and resumes accumulating totalPausedMs', async () => {
    const s = await startSession({ goalId: null })
    await pauseSession(s.id)
    await new Promise((r) => setTimeout(r, 20))
    await resumeSession(s.id)

    const updated = await db.sessions.get(s.id)
    expect(updated?.status).toBe('running')
    expect(updated?.pausedAt).toBeNull()
    expect(updated?.totalPausedMs ?? 0).toBeGreaterThanOrEqual(20)
  })

  it('stops a running session', async () => {
    const s = await startSession({ goalId: null })
    await stopSession(s.id)
    const updated = await db.sessions.get(s.id)
    expect(updated?.status).toBe('completed')
    expect(updated?.endedAt).not.toBeNull()
    expect(await getActiveSession()).toBeNull()
  })

  it('stops a paused session closing the pending pause', async () => {
    const s = await startSession({ goalId: null })
    await pauseSession(s.id)
    await new Promise((r) => setTimeout(r, 15))
    await stopSession(s.id)
    const updated = await db.sessions.get(s.id)
    expect(updated?.status).toBe('completed')
    expect(updated?.totalPausedMs ?? 0).toBeGreaterThanOrEqual(15)
  })

  it('discards a running session', async () => {
    const s = await startSession({ goalId: null })
    await discardSession(s.id)
    const updated = await db.sessions.get(s.id)
    expect(updated?.status).toBe('discarded')
    expect(await getActiveSession()).toBeNull()
  })

  it('lists completed sessions newest first', async () => {
    const a = await startSession({ goalId: null })
    await stopSession(a.id)
    await new Promise((r) => setTimeout(r, 2))
    const b = await startSession({ goalId: null })
    await stopSession(b.id)

    const list = await listCompletedSessions()
    expect(list.map((s) => s.id)).toEqual([b.id, a.id])
  })

  it('deletes a session hard', async () => {
    const s = await startSession({ goalId: null })
    await stopSession(s.id)
    await deleteSession(s.id)
    expect(await db.sessions.get(s.id)).toBeUndefined()
  })
})

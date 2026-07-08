import { db } from './miga-db'
import { startSessionInputSchema, type Session, type StartSessionInput } from './schema'

export async function getActiveSession(): Promise<Session | null> {
  const running = await db.sessions.where('status').equals('running').first()
  if (running) return running
  const paused = await db.sessions.where('status').equals('paused').first()
  return paused ?? null
}

export async function startSession(input: StartSessionInput): Promise<Session> {
  const parsed = startSessionInputSchema.parse(input)
  const active = await getActiveSession()
  if (active) throw new Error('Ya hay una sesión activa')

  const now = Date.now()
  const session: Session = {
    id: crypto.randomUUID(),
    goalId: parsed.goalId,
    startedAt: now,
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    status: 'running',
    createdAt: now,
    updatedAt: now,
  }
  await db.sessions.add(session)
  return session
}

export async function pauseSession(id: string): Promise<void> {
  const session = await db.sessions.get(id)
  if (!session) throw new Error('Sesión no encontrada')
  if (session.status !== 'running') throw new Error('La sesión no está corriendo')

  const now = Date.now()
  await db.sessions.update(id, { status: 'paused', pausedAt: now, updatedAt: now })
}

export async function resumeSession(id: string): Promise<void> {
  const session = await db.sessions.get(id)
  if (!session) throw new Error('Sesión no encontrada')
  if (session.status !== 'paused' || session.pausedAt === null) {
    throw new Error('La sesión no está pausada')
  }

  const now = Date.now()
  const additionalPaused = now - session.pausedAt
  await db.sessions.update(id, {
    status: 'running',
    pausedAt: null,
    totalPausedMs: session.totalPausedMs + additionalPaused,
    updatedAt: now,
  })
}

export async function stopSession(id: string): Promise<void> {
  const session = await db.sessions.get(id)
  if (!session) throw new Error('Sesión no encontrada')
  if (session.status !== 'running' && session.status !== 'paused') {
    throw new Error('La sesión ya no está activa')
  }

  const now = Date.now()
  const extraPause =
    session.status === 'paused' && session.pausedAt !== null ? now - session.pausedAt : 0

  await db.sessions.update(id, {
    status: 'completed',
    pausedAt: null,
    endedAt: now,
    totalPausedMs: session.totalPausedMs + extraPause,
    updatedAt: now,
  })
}

export async function discardSession(id: string): Promise<void> {
  const session = await db.sessions.get(id)
  if (!session) throw new Error('Sesión no encontrada')
  if (session.status !== 'running' && session.status !== 'paused') {
    throw new Error('La sesión ya no está activa')
  }

  const now = Date.now()
  await db.sessions.update(id, {
    status: 'discarded',
    pausedAt: null,
    endedAt: now,
    updatedAt: now,
  })
}

export function listCompletedSessions(): Promise<Session[]> {
  return db.sessions.where('status').equals('completed').reverse().sortBy('endedAt')
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id)
}

import { z } from 'zod'

const dayIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDayFormat')

export const goalInputSchema = z.object({
  name: z.string().trim().min(2, 'nameMin').max(60, 'nameMax'),
  targetMinutes: z
    .number()
    .int('targetInt')
    .min(15, 'targetMin')
    .max(60 * 24 * 365, 'targetMax'),
  scheduledDays: z.array(dayIso).min(1, 'selectDays'),
})

export type GoalInput = z.infer<typeof goalInputSchema>

export type Goal = GoalInput & {
  id: string
  createdAt: number
  updatedAt: number
}

export const sessionStatus = z.enum(['running', 'paused', 'completed', 'discarded'])
export type SessionStatus = z.infer<typeof sessionStatus>

export const startSessionInputSchema = z.object({
  goalId: z.uuid().nullable(),
})
export type StartSessionInput = z.infer<typeof startSessionInputSchema>

export type Session = {
  id: string
  goalId: string | null
  startedAt: number
  pausedAt: number | null
  endedAt: number | null
  totalPausedMs: number
  status: SessionStatus
  createdAt: number
  updatedAt: number
}

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

export const materialKind = z.enum(['link', 'note', 'video-youtube', 'video-upload', 'pdf'])
export type MaterialKind = z.infer<typeof materialKind>

const httpUrl = z.string().refine(
  (raw) => {
    try {
      const parsed = new URL(raw)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  },
  { message: 'invalidUrl' },
)

export const materialMetadataSchema = z.object({
  provider: z.enum(['youtube', 'upload', 'pdf']).optional(),
  youtubeVideoId: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  author: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  totalPages: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
})

export type MaterialMetadata = z.infer<typeof materialMetadataSchema>

export const materialInputSchema = z
  .object({
    kind: materialKind,
    title: z.string().trim().min(1, 'titleRequired').max(80, 'titleMax'),
    url: httpUrl.optional(),
    notes: z.string().max(500, 'notesMax').optional(),
    fileBlobKey: z.string().optional(),
    metadata: materialMetadataSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'link' || data.kind === 'video-youtube') {
      if (!data.url) {
        ctx.addIssue({
          code: 'custom',
          message: 'urlRequired',
          path: ['url'],
        })
      }
    }
    if (data.kind === 'note') {
      if (!data.notes || data.notes.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'notesRequired',
          path: ['notes'],
        })
      }
    }
    if (data.kind === 'video-upload' || data.kind === 'pdf') {
      if (!data.fileBlobKey) {
        ctx.addIssue({
          code: 'custom',
          message: 'fileRequired',
          path: ['fileBlobKey'],
        })
      }
    }
  })

export type MaterialInput = z.infer<typeof materialInputSchema>

export type Material = {
  id: string
  kind: MaterialKind
  title: string
  url?: string
  notes?: string
  fileBlobKey?: string
  metadata: MaterialMetadata
  createdAt: number
  updatedAt: number
}

export type MaterialGoalLink = {
  id: string
  materialId: string
  goalId: string
  createdAt: number
}

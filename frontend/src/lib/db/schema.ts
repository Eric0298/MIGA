import { z } from 'zod'

const dayIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido')

export const goalInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(60, 'Máximo 60 caracteres'),
  targetMinutes: z
    .number()
    .int('Debe ser un número entero')
    .min(15, 'Mínimo 15 minutos totales')
    .max(60 * 24 * 365, 'Máximo un año en minutos'),
  scheduledDays: z.array(dayIso).min(1, 'Selecciona al menos un día en el calendario'),
})

export type GoalInput = z.infer<typeof goalInputSchema>

export type Goal = GoalInput & {
  id: string
  createdAt: number
  updatedAt: number
}

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Goal } from '@/lib/db/schema'
import { deleteGoal } from '@/lib/db/goals.repository'
import { formatMinutes } from '../utils'

type GoalCardProps = {
  goal: Goal
}

function GoalCard({ goal }: GoalCardProps) {
  const dayCount = goal.scheduledDays.length

  const handleDelete = async () => {
    try {
      await deleteGoal(goal.id)
      toast.success('Meta borrada')
    } catch {
      toast.error('No se pudo borrar la meta')
    }
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl bg-surface p-5">
      <div className="flex-1">
        <h3 className="text-base font-semibold text-charcoal">{goal.name}</h3>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          {formatMinutes(goal.targetMinutes)} · {dayCount} {dayCount === 1 ? 'día' : 'días'}{' '}
          planificados
        </p>
      </div>
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`Borrar meta ${goal.name}`}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </li>
  )
}

export default GoalCard

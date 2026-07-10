import { Trash2 } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { ExamAttempt, Goal, Session } from '@/lib/db/schema'
import { deleteGoal } from '@/lib/db/goals.repository'
import {
  filterCompletedByGoal,
  filterFinishedExamsByGoal,
  sumElapsedMs,
  sumExamElapsedMs,
} from '@/lib/stats/sessions-stats'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import GoalProgress from './GoalProgress'

type GoalCardProps = {
  goal: Goal
  sessions: Session[]
  examAttempts?: ExamAttempt[]
}

function GoalCard({ goal, sessions, examAttempts = [] }: GoalCardProps) {
  const { t } = useT()
  const goalSessions = filterCompletedByGoal(sessions, goal.id)
  const goalExams = filterFinishedExamsByGoal(examAttempts, goal.id)
  const currentMs = sumElapsedMs(goalSessions) + sumExamElapsedMs(goalExams)
  const dayCount = goal.scheduledDays.length

  const handleDelete = async () => {
    try {
      await deleteGoal(goal.id)
      toast.success(t.goals.goalDeleted)
    } catch {
      toast.error(t.goals.cannotDelete)
    }
  }

  const daysLabel =
    dayCount === 1
      ? tpl(t.goals.dayPlannedOne, { count: dayCount })
      : tpl(t.goals.dayPlannedOther, { count: dayCount })

  return (
    <li className="flex flex-col gap-4 rounded-2xl bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/app/metas/${goal.id}`} className="flex-1">
          <h3 className="text-base font-semibold text-charcoal">{goal.name}</h3>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{daysLabel}</p>
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={tpl(t.goals.deleteGoal, { name: goal.name })}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[color:var(--color-text-muted)] transition-colors hover:bg-cream hover:text-charcoal"
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>

      <GoalProgress currentMs={currentMs} targetMinutes={goal.targetMinutes} />
    </li>
  )
}

export default GoalCard

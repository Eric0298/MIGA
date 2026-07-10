import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Brain } from 'lucide-react'
import { useLiveGoal } from '@/features/goals/hooks/use-goal'
import { useQuestionsByGoal } from '@/features/questions/hooks/use-questions-by-goal'
import QuestionsPanel from '@/features/questions/components/QuestionsPanel'
import { useT } from '@/i18n/i18n-context'
import EmptyState from '@/components/ui/EmptyState'

function RepasoGoalPage() {
  const { t } = useT()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)
  const questions = useQuestionsByGoal(goal?.id)
  const hasQuestions = (questions?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/app/repaso"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.repaso.backToRepaso}
        </Link>
      </header>

      {goal === undefined && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {goal === null && (
        <EmptyState
          title={t.goalDetail.notFoundTitle}
          description={t.goalDetail.notFoundDescription}
          action={
            <Link
              to="/app/repaso"
              className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
            >
              {t.repaso.backToRepaso}
            </Link>
          }
        />
      )}

      {goal && (
        <>
          <section className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-charcoal">{goal.name}</h1>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {t.repaso.perGoalSubtitle}
            </p>
          </section>

          <QuestionsPanel goalId={goal.id} />

          {hasQuestions && (
            <button
              type="button"
              onClick={() => navigate(`/app/repaso/${goal.id}/sesion`)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98]"
            >
              <Brain size={18} aria-hidden="true" />
              {t.repaso.startReview}
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default RepasoGoalPage

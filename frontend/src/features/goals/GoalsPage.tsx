import { useState } from 'react'
import { Plus, Target } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useCompletedSessions } from '@/features/sessions/hooks/use-completed-sessions'
import { useAllExamAttempts } from '@/features/exams/hooks/use-all-exam-attempts'
import { useT } from '@/i18n/i18n-context'
import { useLiveGoals } from './hooks/use-goals'
import GoalForm from './components/GoalForm'
import GoalCard from './components/GoalCard'

function GoalsPage() {
  const { t } = useT()
  const [showForm, setShowForm] = useState(false)
  const goals = useLiveGoals()
  const sessions = useCompletedSessions()
  const examAttempts = useAllExamAttempts()

  const isLoading = goals === undefined
  const isEmpty = !isLoading && goals.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-charcoal lg:text-3xl">{t.goals.title}</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-apricot px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <Plus size={16} aria-hidden="true" />
            {t.goals.newGoal}
          </button>
        )}
      </header>

      {showForm && (
        <GoalForm onCreated={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      )}

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {isEmpty && !showForm && (
        <EmptyState
          icon={<Target size={20} aria-hidden="true" />}
          title={t.goals.emptyTitle}
          description={t.goals.emptyDescription}
        />
      )}

      {!isLoading && goals.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              sessions={sessions ?? []}
              examAttempts={examAttempts ?? []}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default GoalsPage

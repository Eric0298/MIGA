import { useState } from 'react'
import { Plus, Target } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useLiveGoals } from './hooks/use-goals'
import GoalForm from './components/GoalForm'
import GoalCard from './components/GoalCard'

function GoalsPage() {
  const [showForm, setShowForm] = useState(false)
  const goals = useLiveGoals()

  const isLoading = goals === undefined
  const isEmpty = !isLoading && goals.length === 0

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-charcoal">Metas</h1>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-apricot px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            <Plus size={16} aria-hidden="true" />
            Nueva meta
          </button>
        )}
      </header>

      {showForm && (
        <GoalForm onCreated={() => setShowForm(false)} onCancel={() => setShowForm(false)} />
      )}

      {isLoading && <p className="text-sm text-[color:var(--color-text-muted)]">Cargando…</p>}

      {isEmpty && !showForm && (
        <EmptyState
          icon={<Target size={20} aria-hidden="true" />}
          title="Aún no hay metas"
          description="Crea tu primera meta eligiendo los días o semanas en los que quieres avanzar."
        />
      )}

      {!isLoading && goals.length > 0 && (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default GoalsPage

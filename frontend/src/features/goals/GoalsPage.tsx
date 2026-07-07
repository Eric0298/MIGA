import { Target } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

function GoalsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Metas</h1>
      </header>

      <EmptyState
        icon={<Target size={20} aria-hidden="true" />}
        title="Aún no hay metas"
        description="Podrás definir objetivos por tiempo semanal cuando llegue la próxima fase."
      />
    </div>
  )
}

export default GoalsPage

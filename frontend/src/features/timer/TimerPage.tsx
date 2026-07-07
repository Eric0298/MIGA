import { Timer } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

function TimerPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Timer</h1>
      </header>

      <EmptyState
        icon={<Timer size={20} aria-hidden="true" />}
        title="Sin sesión activa"
        description="Podrás iniciar sesiones de trabajo por tiempo real."
      />
    </div>
  )
}

export default TimerPage

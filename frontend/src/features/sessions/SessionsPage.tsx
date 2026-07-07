import { Clock } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

function SessionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Sesiones</h1>
      </header>

      <EmptyState
        icon={<Clock size={20} aria-hidden="true" />}
        title="Sin sesiones registradas"
        description="Cada sesión de tiempo real quedará listada aquí."
      />
    </div>
  )
}

export default SessionsPage

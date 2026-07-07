import { Sparkles } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'

function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Inicio</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          Modo invitado local. Aún sin datos.
        </p>
      </header>

      <EmptyState
        icon={<Sparkles size={20} aria-hidden="true" />}
        title="Todo empieza con una acción"
        description="Cuando registres tu primera sesión verás tu avance aquí."
      />
    </div>
  )
}

export default HomePage

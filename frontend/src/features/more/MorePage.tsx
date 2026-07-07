import { Link } from 'react-router'

function MorePage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">Más</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
          Ajustes, exportar/importar y ayuda vendrán más adelante.
        </p>
      </header>

      <nav aria-label="Enlaces adicionales" className="flex flex-col gap-3">
        <Link
          to="/arquitectura"
          className="rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal"
        >
          Ver arquitectura
        </Link>
        <Link
          to="/"
          className="rounded-2xl bg-surface px-5 py-4 text-base font-semibold text-charcoal"
        >
          Volver a la landing
        </Link>
      </nav>
    </div>
  )
}

export default MorePage

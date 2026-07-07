import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'

function ArchitecturePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-8 pb-16">
      <header className="flex items-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </Link>
      </header>

      <section className="mt-10">
        <h1 className="text-3xl font-extrabold text-charcoal">Arquitectura</h1>
        <p className="mt-3 text-base leading-relaxed text-[color:var(--color-text-muted)]">
          Miga es una PWA mobile-first con modo invitado local. Sin login
          obligatorio, sin IA, sin nube forzada.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-charcoal">Frontend</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--color-text-muted)]">
          <li>React 19 + TypeScript + Vite</li>
          <li>Tailwind CSS v4 con tokens de marca</li>
          <li>React Router para navegación</li>
          <li>PWA instalable via vite-plugin-pwa</li>
          <li>Persistencia local con Dexie (próxima fase)</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-charcoal">Backend</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--color-text-muted)]">
          <li>ASP.NET Core (.NET 10) por capas</li>
          <li>PostgreSQL en Docker</li>
          <li>EF Core y Serilog</li>
          <li>Health check en /api/health y /api/health/db</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-charcoal">Principios</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--color-text-muted)]">
          <li>Local-first: la app funciona sin cuenta.</li>
          <li>Timer basado en marcas de tiempo, no en setInterval.</li>
          <li>Seguridad desde el diseño.</li>
          <li>Sin IA en el MVP.</li>
        </ul>
      </section>
    </main>
  )
}

export default ArchitecturePage

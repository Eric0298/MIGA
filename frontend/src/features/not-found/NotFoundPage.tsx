import { Link } from 'react-router'

function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-3xl font-extrabold text-charcoal">Ruta no encontrada</h1>
      <p className="mt-3 text-sm text-[color:var(--color-text-muted)]">
        La página que buscas no existe o aún no está disponible.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
      >
        Volver al inicio
      </Link>
    </main>
  )
}

export default NotFoundPage

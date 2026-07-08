import { Link } from 'react-router'
import { useT } from '@/i18n/i18n-context'

function NotFoundPage() {
  const { t } = useT()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-3xl font-extrabold text-charcoal">{t.notFound.title}</h1>
      <p className="mt-3 text-sm text-[color:var(--color-text-muted)]">{t.notFound.description}</p>
      <Link
        to="/"
        className="mt-6 rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
      >
        {t.notFound.back}
      </Link>
    </main>
  )
}

export default NotFoundPage

import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useT } from '@/i18n/i18n-context'

function ArchitecturePage() {
  const { t } = useT()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-8 pb-16">
      <header className="flex items-center">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-charcoal">
          <ArrowLeft size={18} aria-hidden="true" />
          {t.common.back}
        </Link>
      </header>

      <section className="mt-10">
        <h1 className="text-3xl font-extrabold text-charcoal">{t.architecture.title}</h1>
        <p className="mt-3 text-base leading-relaxed text-[color:var(--color-text-muted)]">
          {t.architecture.intro}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-charcoal">{t.architecture.frontend}</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--color-text-muted)]">
          <li>{t.architecture.frontendReact}</li>
          <li>{t.architecture.frontendTailwind}</li>
          <li>{t.architecture.frontendRouter}</li>
          <li>{t.architecture.frontendPwa}</li>
          <li>{t.architecture.frontendDexie}</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-charcoal">{t.architecture.backend}</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--color-text-muted)]">
          <li>{t.architecture.backendAspnet}</li>
          <li>{t.architecture.backendPostgres}</li>
          <li>{t.architecture.backendEfSerilog}</li>
          <li>{t.architecture.backendHealth}</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-charcoal">{t.architecture.principles}</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-[color:var(--color-text-muted)]">
          <li>{t.architecture.principleLocalFirst}</li>
          <li>{t.architecture.principleTimer}</li>
          <li>{t.architecture.principleSecurity}</li>
          <li>{t.architecture.principleNoAi}</li>
        </ul>
      </section>
    </main>
  )
}

export default ArchitecturePage

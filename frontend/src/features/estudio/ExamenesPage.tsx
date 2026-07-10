import { Link } from 'react-router'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'
import { useT } from '@/i18n/i18n-context'
import EmptyState from '@/components/ui/EmptyState'

function ExamenesPage() {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/app/estudio"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.estudio.backToHub}
        </Link>
      </header>

      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-charcoal">{t.examenes.title}</h1>
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.examenes.subtitle}</p>
      </section>

      <EmptyState
        icon={<ClipboardCheck size={20} aria-hidden="true" />}
        title={t.examenes.comingSoonTitle}
        description={t.examenes.comingSoonDescription}
      />
    </div>
  )
}

export default ExamenesPage

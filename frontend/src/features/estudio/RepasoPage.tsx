import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { db } from '@/lib/db/miga-db'
import { useT } from '@/i18n/i18n-context'
import GoalsBrowseGrid from './components/GoalsBrowseGrid'

function RepasoPage() {
  const { t } = useT()
  const goals = useLiveGoals()
  const counts = useLiveQuery(async () => {
    const rows = await db.questions.toArray()
    const acc: Record<string, number> = {}
    for (const q of rows) {
      acc[q.goalId] = (acc[q.goalId] ?? 0) + 1
    }
    return acc
  }, [])

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

      <section className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">{t.repaso.title}</h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{t.repaso.subtitle}</p>
        </div>

        {goals === undefined ? (
          <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
        ) : (
          <GoalsBrowseGrid
            goals={goals}
            counts={counts ?? {}}
            basePath="/app/repaso"
            itemLabelOne={t.repaso.questionsCountOne}
            itemLabelOther={t.repaso.questionsCountOther}
            emptyGoalsTitle={t.repaso.emptyGoalsTitle}
            emptyGoalsDescription={t.repaso.emptyGoalsDescription}
          />
        )}
      </section>
    </div>
  )
}

export default RepasoPage

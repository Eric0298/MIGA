import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { db } from '@/lib/db/miga-db'
import { useT } from '@/i18n/i18n-context'
import GoalsBrowseGrid from './components/GoalsBrowseGrid'

function ExamenesPage() {
  const { t } = useT()
  const goals = useLiveGoals()
  const counts = useLiveQuery(async () => {
    const rows = await db.examAttempts.toArray()
    const acc: Record<string, number> = {}
    for (const attempt of rows) {
      if (attempt.status === 'discarded') continue
      acc[attempt.goalId] = (acc[attempt.goalId] ?? 0) + 1
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
          <h1 className="text-2xl font-bold text-charcoal">{t.examenes.title}</h1>
          <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
            {t.examenes.subtitle}
          </p>
        </div>

        {goals === undefined ? (
          <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
        ) : (
          <GoalsBrowseGrid
            goals={goals}
            counts={counts ?? {}}
            basePath="/app/examenes"
            itemLabelOne={t.examenes.attemptsCountOne}
            itemLabelOther={t.examenes.attemptsCountOther}
            emptyGoalsTitle={t.examenes.emptyGoalsTitle}
            emptyGoalsDescription={t.examenes.emptyGoalsDescription}
          />
        )}
      </section>
    </div>
  )
}

export default ExamenesPage

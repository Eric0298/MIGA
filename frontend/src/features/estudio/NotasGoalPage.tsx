import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useLiveGoal } from '@/features/goals/hooks/use-goal'
import NotesPanel from '@/features/notes/components/NotesPanel'
import { useT } from '@/i18n/i18n-context'
import EmptyState from '@/components/ui/EmptyState'

/**
 * Per-goal notes view. Reachable at /app/notas/:id (redirected to from the
 * legacy /app/apuntes/:id) so users can browse and edit a single goal's
 * notes with the goal pre-selected in the editor.
 */
function NotasGoalPage() {
  const { t } = useT()
  const { id } = useParams<{ id: string }>()
  const goal = useLiveGoal(id)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          to="/app/notas"
          className="inline-flex items-center gap-2 text-sm font-medium text-charcoal"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          {t.apuntesHub.backToApuntes}
        </Link>
      </header>

      {goal === undefined && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {goal === null && (
        <EmptyState
          title={t.goalDetail.notFoundTitle}
          description={t.goalDetail.notFoundDescription}
          action={
            <Link
              to="/app/notas"
              className="inline-flex rounded-2xl bg-apricot px-5 py-3 text-sm font-semibold text-white"
            >
              {t.apuntesHub.backToApuntes}
            </Link>
          }
        />
      )}

      {goal && (
        <>
          <section className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-charcoal">{goal.name}</h1>
            <p className="text-sm text-[color:var(--color-text-muted)]">
              {t.apuntesHub.perGoalSubtitle}
            </p>
          </section>

          <NotesPanel goalId={goal.id} />
        </>
      )}
    </div>
  )
}

export default NotasGoalPage

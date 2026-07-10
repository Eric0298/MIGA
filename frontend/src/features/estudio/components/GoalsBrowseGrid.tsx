import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import type { Goal } from '@/lib/db/schema'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'

type GoalsBrowseGridProps = {
  goals: Goal[]
  /** Map of goal.id → count to show on the badge (e.g. number of questions). */
  counts: Record<string, number>
  /** `to` for each card = `${basePath}/${goal.id}`. */
  basePath: string
  /** Translation key for the "N cosas" badge (e.g. "N preguntas"). */
  itemLabelOne: string
  itemLabelOther: string
  /** Message when the user has no goals at all. */
  emptyGoalsTitle: string
  emptyGoalsDescription: string
}

/**
 * Shared browser grid used by Apuntes and Repaso hubs: shows every goal as
 * a tappable card with a count badge (questions or notes attached to it).
 */
function GoalsBrowseGrid({
  goals,
  counts,
  basePath,
  itemLabelOne,
  itemLabelOther,
  emptyGoalsTitle,
  emptyGoalsDescription,
}: GoalsBrowseGridProps) {
  const { t } = useT()

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface p-8 text-center">
        <p className="text-base font-semibold text-charcoal">{emptyGoalsTitle}</p>
        <p className="text-sm text-[color:var(--color-text-muted)]">{emptyGoalsDescription}</p>
        <Link
          to="/app/metas"
          className="mt-2 inline-flex rounded-2xl bg-apricot px-4 py-2 text-sm font-semibold text-white transition active:scale-[0.98]"
        >
          {t.estudio.goToGoals}
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {goals.map((goal) => {
        const count = counts[goal.id] ?? 0
        const badgeLabel =
          count === 1
            ? tpl(itemLabelOne, { count })
            : tpl(itemLabelOther, { count })
        return (
          <Link
            key={goal.id}
            to={`${basePath}/${goal.id}`}
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-charcoal">{goal.name}</p>
              <span
                className={clsx(
                  'mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  count > 0 ? 'bg-peach text-charcoal' : 'bg-cream text-[color:var(--color-text-muted)]',
                )}
              >
                {badgeLabel}
              </span>
            </div>
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="shrink-0 text-[color:var(--color-text-muted)]"
            />
          </Link>
        )
      })}
    </div>
  )
}

export default GoalsBrowseGrid

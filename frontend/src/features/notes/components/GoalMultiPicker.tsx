import { Check } from 'lucide-react'
import { clsx } from 'clsx'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { useT } from '@/i18n/i18n-context'

type GoalMultiPickerProps = {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  error?: string | null
}

/**
 * Compact chip picker used inside note editors so an apunte can be pinned to
 * one or more goals at create/edit time. Reads goals live from Dexie because
 * the user might create a new one from another tab.
 */
function GoalMultiPicker({ selectedIds, onChange, error }: GoalMultiPickerProps) {
  const { t } = useT()
  const goals = useLiveGoals()
  const selected = new Set(selectedIds)

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(selectedIds.filter((g) => g !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
        {t.notes.selectGoalsTitle}
      </span>
      {goals === undefined ? (
        <p className="text-xs text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      ) : goals.length === 0 ? (
        <p className="rounded-xl bg-cream px-3 py-2 text-xs text-[color:var(--color-text-muted)] ring-1 ring-[color:var(--color-border)]">
          {t.notes.noGoalsAvailable}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {goals.map((goal) => {
            const active = selected.has(goal.id)
            return (
              <li key={goal.id}>
                <button
                  type="button"
                  onClick={() => toggle(goal.id)}
                  aria-pressed={active}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    active
                      ? 'bg-apricot text-white'
                      : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)] hover:bg-peach',
                  )}
                >
                  <span
                    className={clsx(
                      'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-md',
                      active
                        ? 'bg-white/25 text-white'
                        : 'bg-white/60 text-[color:var(--color-text-muted)]',
                    )}
                    aria-hidden="true"
                  >
                    {active ? <Check size={10} /> : null}
                  </span>
                  <span className="max-w-[10rem] truncate">{goal.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="text-xs text-apricot">{error}</p>}
    </div>
  )
}

export default GoalMultiPicker

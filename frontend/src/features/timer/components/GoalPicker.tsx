import { clsx } from 'clsx'
import { useLiveGoals } from '@/features/goals/hooks/use-goals'
import { useT } from '@/i18n/i18n-context'

type GoalPickerProps = {
  value: string | null
  onChange: (goalId: string | null) => void
}

function GoalPicker({ value, onChange }: GoalPickerProps) {
  const { t } = useT()
  const goals = useLiveGoals()

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={clsx(
          'w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors',
          value === null
            ? 'bg-apricot text-white'
            : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
        )}
      >
        {t.common.freeSession}
      </button>
      {goals?.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onChange(g.id)}
          className={clsx(
            'w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors',
            value === g.id
              ? 'bg-apricot text-white'
              : 'bg-cream text-charcoal ring-1 ring-[color:var(--color-border)]',
          )}
        >
          {g.name}
        </button>
      ))}
    </div>
  )
}

export default GoalPicker

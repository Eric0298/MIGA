import { clsx } from 'clsx'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import { formatMinutes } from '../utils'

type GoalProgressProps = {
  currentMs: number
  targetMinutes: number
}

function GoalProgress({ currentMs, targetMinutes }: GoalProgressProps) {
  const { t } = useT()
  const currentMinutes = Math.floor(currentMs / 60_000)
  const rawPercent = targetMinutes === 0 ? 0 : (currentMinutes / targetMinutes) * 100
  const percent = Math.min(100, Math.round(rawPercent))
  const complete = currentMinutes >= targetMinutes

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-charcoal">
          {formatMinutes(currentMinutes)}{' '}
          <span className="text-[color:var(--color-text-muted)]">
            {tpl(t.goals.ofTotal, { total: formatMinutes(targetMinutes) })}
          </span>
        </p>
        <p className="text-xs font-semibold text-charcoal tabular-nums">{percent}%</p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cream">
        <div
          className={clsx(
            'h-full rounded-full transition-all',
            complete ? 'bg-pistachio' : 'bg-apricot',
          )}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        />
      </div>
    </div>
  )
}

export default GoalProgress

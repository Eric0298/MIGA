import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { useT } from '@/i18n/i18n-context'
import { tpl } from '@/i18n/tpl'
import {
  DAY_LABELS,
  formatMonthLabel,
  getMonthMatrix,
  isSameMonth,
  nextMonth,
  previousMonth,
  todayIso,
  toIso,
} from '../utils'

type GoalCalendarViewProps = {
  scheduledDays: Set<string>
  workedDays: Set<string>
  initialMonth?: Date
}

function GoalCalendarView({ scheduledDays, workedDays, initialMonth }: GoalCalendarViewProps) {
  const { t, locale } = useT()
  const [visibleMonth, setVisibleMonth] = useState(() => initialMonth ?? new Date())
  const matrix = useMemo(() => getMonthMatrix(visibleMonth), [visibleMonth])
  const today = todayIso()
  const monthLabel = formatMonthLabel(visibleMonth, locale)

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVisibleMonth(previousMonth(visibleMonth))}
          aria-label={t.calendar.previousMonth}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-charcoal transition-colors hover:bg-cream"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-charcoal">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setVisibleMonth(nextMonth(visibleMonth))}
          aria-label={t.calendar.nextMonth}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-charcoal transition-colors hover:bg-cream"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </header>

      <div
        className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[color:var(--color-text-muted)]"
        role="grid"
        aria-label={tpl(t.calendar.monthAria, { month: monthLabel })}
      >
        {DAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}

        {matrix.flat().map((day) => {
          const iso = toIso(day)
          const inMonth = isSameMonth(visibleMonth, day)
          const planned = scheduledDays.has(iso)
          const worked = workedDays.has(iso)
          const isToday = iso === today
          const ariaTemplate =
            planned && worked
              ? t.calendar.dayAriaPlannedWorked
              : planned
                ? t.calendar.dayAriaPlanned
                : worked
                  ? t.calendar.dayAriaWorked
                  : t.calendar.dayAria
          return (
            <div
              key={iso}
              className={clsx(
                'flex h-10 flex-col items-center justify-center rounded-xl text-sm transition-colors',
                planned
                  ? worked
                    ? 'bg-pistachio text-charcoal font-semibold'
                    : 'bg-peach text-charcoal font-medium'
                  : worked
                    ? 'bg-cream text-charcoal font-medium ring-1 ring-pistachio'
                    : 'text-charcoal',
                !inMonth && 'opacity-40',
                isToday && !planned && !worked && 'ring-1 ring-apricot',
              )}
              aria-label={tpl(ariaTemplate, { day: day.getDate() })}
            >
              <span>{day.getDate()}</span>
            </div>
          )
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--color-text-muted)]">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-peach" aria-hidden="true" />
          {t.calendar.legendPlanned}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-pistachio" aria-hidden="true" />
          {t.calendar.legendWorked}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded ring-1 ring-apricot" aria-hidden="true" />
          {t.calendar.legendToday}
        </li>
      </ul>
    </div>
  )
}

export default GoalCalendarView

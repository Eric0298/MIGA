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
  toIso,
} from '../utils'

type MonthCalendarProps = {
  selectedDays: Set<string>
  onToggleDay: (iso: string) => void
  onToggleWeek: (weekIsoDays: string[]) => void
}

function MonthCalendar({ selectedDays, onToggleDay, onToggleWeek }: MonthCalendarProps) {
  const { t, locale } = useT()
  const [visibleMonth, setVisibleMonth] = useState(() => new Date())
  const matrix = useMemo(() => getMonthMatrix(visibleMonth), [visibleMonth])
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
        className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 text-center text-xs font-medium text-[color:var(--color-text-muted)]"
        role="grid"
        aria-label={tpl(t.calendar.monthAria, { month: monthLabel })}
      >
        <span aria-hidden="true" />
        {DAY_LABELS.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}

        {matrix.map((week, weekIndex) => {
          const isoDays = week.map((d) => toIso(d))
          const allSelected = isoDays.every((iso) => selectedDays.has(iso))
          return (
            <FragmentRow
              key={weekIndex}
              week={week}
              isoDays={isoDays}
              visibleMonth={visibleMonth}
              selectedDays={selectedDays}
              allSelected={allSelected}
              onToggleDay={onToggleDay}
              onToggleWeek={onToggleWeek}
              weekLabel={t.calendar.week}
              selectWeekLabel={t.calendar.selectWeek}
              unselectWeekLabel={t.calendar.unselectWeek}
              dayAriaTemplate={t.calendar.dayAria}
            />
          )
        })}
      </div>
    </div>
  )
}

type RowProps = {
  week: Date[]
  isoDays: string[]
  visibleMonth: Date
  selectedDays: Set<string>
  allSelected: boolean
  onToggleDay: (iso: string) => void
  onToggleWeek: (weekIsoDays: string[]) => void
  weekLabel: string
  selectWeekLabel: string
  unselectWeekLabel: string
  dayAriaTemplate: string
}

function FragmentRow({
  week,
  isoDays,
  visibleMonth,
  selectedDays,
  allSelected,
  onToggleDay,
  onToggleWeek,
  weekLabel,
  selectWeekLabel,
  unselectWeekLabel,
  dayAriaTemplate,
}: RowProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => onToggleWeek(isoDays)}
        aria-label={allSelected ? unselectWeekLabel : selectWeekLabel}
        aria-pressed={allSelected}
        className={clsx(
          'flex h-10 items-center justify-center rounded-xl text-[10px] font-semibold transition-colors',
          allSelected
            ? 'bg-pistachio text-charcoal'
            : 'bg-cream text-[color:var(--color-text-muted)] hover:bg-peach hover:text-charcoal',
        )}
      >
        {weekLabel}
      </button>
      {week.map((day, dayIndex) => {
        const iso = isoDays[dayIndex]
        const inMonth = isSameMonth(visibleMonth, day)
        const selected = selectedDays.has(iso)
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onToggleDay(iso)}
            aria-pressed={selected}
            aria-label={tpl(dayAriaTemplate, { day: day.getDate() })}
            className={clsx(
              'flex h-10 items-center justify-center rounded-xl text-sm font-medium transition-colors',
              selected
                ? 'bg-apricot text-white'
                : inMonth
                  ? 'bg-cream text-charcoal hover:bg-peach'
                  : 'bg-transparent text-[color:var(--color-text-muted)] opacity-50 hover:opacity-100',
            )}
          >
            {day.getDate()}
          </button>
        )
      })}
    </>
  )
}

export default MonthCalendar

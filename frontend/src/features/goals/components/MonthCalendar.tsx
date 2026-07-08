import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
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
  const [visibleMonth, setVisibleMonth] = useState(() => new Date())
  const matrix = useMemo(() => getMonthMatrix(visibleMonth), [visibleMonth])

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setVisibleMonth(previousMonth(visibleMonth))}
          aria-label="Mes anterior"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-charcoal transition-colors hover:bg-cream"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-charcoal">
          {formatMonthLabel(visibleMonth)}
        </span>
        <button
          type="button"
          onClick={() => setVisibleMonth(nextMonth(visibleMonth))}
          aria-label="Mes siguiente"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-charcoal transition-colors hover:bg-cream"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </header>

      <div
        className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 text-center text-xs font-medium text-[color:var(--color-text-muted)]"
        role="grid"
        aria-label={`Calendario de ${formatMonthLabel(visibleMonth)}`}
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
}

function FragmentRow({
  week,
  isoDays,
  visibleMonth,
  selectedDays,
  allSelected,
  onToggleDay,
  onToggleWeek,
}: RowProps) {
  return (
    <>
      <button
        type="button"
        onClick={() => onToggleWeek(isoDays)}
        aria-label={allSelected ? 'Deseleccionar semana' : 'Seleccionar toda la semana'}
        aria-pressed={allSelected}
        className={clsx(
          'flex h-10 items-center justify-center rounded-xl text-[10px] font-semibold transition-colors',
          allSelected
            ? 'bg-pistachio text-charcoal'
            : 'bg-cream text-[color:var(--color-text-muted)] hover:bg-peach hover:text-charcoal',
        )}
      >
        Sem
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
            aria-label={`Día ${day.getDate()}`}
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

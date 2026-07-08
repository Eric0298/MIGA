import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createGoal } from '@/lib/db/goals.repository'
import { goalInputSchema } from '@/lib/db/schema'
import { combineHoursMinutes, formatMinutes, splitHoursMinutes } from '../utils'
import MonthCalendar from './MonthCalendar'

type GoalFormProps = {
  onCreated?: () => void
  onCancel?: () => void
}

const DEFAULT_HOURS = 10

function GoalForm({ onCreated, onCancel }: GoalFormProps) {
  const [name, setName] = useState('')
  const [targetMinutes, setTargetMinutes] = useState(DEFAULT_HOURS * 60)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [nameError, setNameError] = useState<string | null>(null)
  const [targetError, setTargetError] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { hours, minutes } = splitHoursMinutes(targetMinutes)
  const dayCount = selection.size
  const perDayAverage = useMemo(() => {
    if (dayCount === 0) return 0
    return Math.round(targetMinutes / dayCount)
  }, [targetMinutes, dayCount])

  const toggleDay = (iso: string) => {
    setSelectionError(null)
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })
  }

  const toggleWeek = (weekIsoDays: string[]) => {
    setSelectionError(null)
    setSelection((prev) => {
      const next = new Set(prev)
      const allSelected = weekIsoDays.every((iso) => next.has(iso))
      if (allSelected) {
        for (const iso of weekIsoDays) next.delete(iso)
      } else {
        for (const iso of weekIsoDays) next.add(iso)
      }
      return next
    })
  }

  const handleHours = (value: number) => {
    setTargetError(null)
    setTargetMinutes(combineHoursMinutes(clamp(value, 0, 500), minutes))
  }

  const handleMinutes = (value: number) => {
    setTargetError(null)
    setTargetMinutes(combineHoursMinutes(hours, clamp(value, 0, 59)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameError(null)
    setTargetError(null)
    setSelectionError(null)

    const scheduledDays = Array.from(selection).sort()
    const parsed = goalInputSchema.safeParse({ name, targetMinutes, scheduledDays })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'name') setNameError(issue.message)
        if (issue.path[0] === 'targetMinutes') setTargetError(issue.message)
        if (issue.path[0] === 'scheduledDays') setSelectionError(issue.message)
      }
      return
    }

    try {
      setSubmitting(true)
      await createGoal(parsed.data)
      toast.success('Meta creada')
      onCreated?.()
    } catch {
      toast.error('No se pudo crear la meta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
        <label htmlFor="goal-name" className="text-sm font-medium text-charcoal">
          Nombre
        </label>
        <input
          id="goal-name"
          type="text"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-xl bg-cream px-4 py-3 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
          placeholder="Preparar oposición"
        />
        {nameError && <p className="text-xs text-apricot">{nameError}</p>}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
        <div>
          <p className="text-sm font-medium text-charcoal">Objetivo total</p>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
            Cuántas horas quieres dedicarle en total a esta meta.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[color:var(--color-text-muted)]">Horas</span>
            <input
              type="number"
              min={0}
              max={500}
              step={1}
              inputMode="numeric"
              value={hours}
              onChange={(e) => handleHours(Number(e.target.value))}
              className="rounded-xl bg-cream px-3 py-2.5 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[color:var(--color-text-muted)]">
              Minutos
            </span>
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              inputMode="numeric"
              value={minutes}
              onChange={(e) => handleMinutes(Number(e.target.value))}
              className="rounded-xl bg-cream px-3 py-2.5 text-base text-charcoal ring-1 ring-[color:var(--color-border)] focus:ring-2 focus:ring-apricot focus:outline-none"
            />
          </label>
        </div>
        {targetError && <p className="text-xs text-apricot">{targetError}</p>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm font-medium text-charcoal">Cuándo lo repartes</p>
            <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">
              Elige días sueltos o semanas enteras. La selección se guarda al cambiar de mes.
            </p>
          </div>
        </div>
        <MonthCalendar selectedDays={selection} onToggleDay={toggleDay} onToggleWeek={toggleWeek} />
        {dayCount > 0 && (
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {dayCount} {dayCount === 1 ? 'día planificado' : 'días planificados'} ·{' '}
            {formatMinutes(perDayAverage)} de media al día
          </p>
        )}
        {selectionError && <p className="text-xs text-apricot">{selectionError}</p>}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-2xl bg-apricot px-5 py-3 text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
        >
          Crear meta
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl bg-surface px-5 py-3 text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

export default GoalForm

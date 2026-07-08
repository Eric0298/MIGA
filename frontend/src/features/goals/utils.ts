import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'

const ISO_FORMAT = 'yyyy-MM-dd'

export function toIso(date: Date): string {
  return format(date, ISO_FORMAT)
}

export function fromIso(iso: string): Date {
  return parse(iso, ISO_FORMAT, new Date())
}

export function todayIso(): string {
  return toIso(new Date())
}

export function getMonthMatrix(reference: Date): Date[][] {
  const monthStart = startOfMonth(reference)
  const monthEnd = endOfMonth(reference)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7))
  }
  return weeks
}

export function nextMonth(reference: Date): Date {
  return addMonths(reference, 1)
}

export function previousMonth(reference: Date): Date {
  return subMonths(reference, 1)
}

export function isSameMonth(reference: Date, day: Date): boolean {
  return reference.getMonth() === day.getMonth() && reference.getFullYear() === day.getFullYear()
}

export function formatMonthLabel(reference: Date): string {
  const label = format(reference, 'LLLL yyyy', { locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDayLabel(iso: string): string {
  const date = fromIso(iso)
  const label = format(date, "EEE d 'de' LLL", { locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDayRelative(iso: string, todayIsoRef: string): string {
  const target = fromIso(iso)
  const today = fromIso(todayIsoRef)
  const diff = differenceInCalendarDays(target, today)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  return formatDayLabel(iso)
}

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0 min'
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (hours === 0) return `${remaining} min`
  if (remaining === 0) return `${hours} h`
  return `${hours} h ${remaining} min`
}

export function splitHoursMinutes(totalMinutes: number): { hours: number; minutes: number } {
  const clamped = Math.max(0, Math.floor(totalMinutes))
  return {
    hours: Math.floor(clamped / 60),
    minutes: clamped % 60,
  }
}

export function combineHoursMinutes(hours: number, minutes: number): number {
  const safeHours = Math.max(0, Math.floor(hours))
  const safeMinutes = Math.max(0, Math.floor(minutes))
  return safeHours * 60 + safeMinutes
}

export const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

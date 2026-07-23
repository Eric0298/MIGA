import {
  BookOpen,
  FileText,
  GraduationCap,
  House,
  ListChecks,
  MoreHorizontal,
  Repeat,
  Target,
  Timer,
} from 'lucide-react'
import type { Messages } from '@/i18n/messages/es'

type NavIcon = typeof House

export type MainNavItem = {
  to: string
  labelKey: 'home' | 'timer' | 'goals' | 'estudio' | 'more'
  icon: NavIcon
  end?: boolean
}

export const mainNavItems: MainNavItem[] = [
  { to: '/app', labelKey: 'home', icon: House, end: true },
  { to: '/app/timer', labelKey: 'timer', icon: Timer },
  { to: '/app/metas', labelKey: 'goals', icon: Target },
  { to: '/app/estudio', labelKey: 'estudio', icon: BookOpen },
  { to: '/app/mas', labelKey: 'more', icon: MoreHorizontal },
]

export type EstudioSubItem = {
  to: string
  icon: NavIcon
  label: (t: Messages) => string
}

export const estudioSubItems: EstudioSubItem[] = [
  { to: '/app/sesiones', icon: ListChecks, label: (t) => t.estudio.tiles.sessions },
  { to: '/app/notas', icon: FileText, label: (t) => t.estudio.tiles.notes },
  { to: '/app/repaso', icon: Repeat, label: (t) => t.estudio.tiles.review },
  { to: '/app/examenes', icon: GraduationCap, label: (t) => t.estudio.tiles.exams },
]

import {
  BarChart3,
  BookOpen,
  FileText,
  GraduationCap,
  House,
  ListChecks,
  Repeat,
  Settings,
  Target,
  Timer,
} from 'lucide-react'
import type { Messages } from '@/i18n/messages/es'

type NavIcon = typeof House

export type MainNavItem = {
  to: string
  labelKey: 'home' | 'timer' | 'goals' | 'estudio' | 'settings'
  icon: NavIcon
  end?: boolean
}

export const mainNavItems: MainNavItem[] = [
  { to: '/app', labelKey: 'home', icon: House, end: true },
  { to: '/app/timer', labelKey: 'timer', icon: Timer },
  { to: '/app/metas', labelKey: 'goals', icon: Target },
  { to: '/app/estudio', labelKey: 'estudio', icon: BookOpen },
  { to: '/app/configuracion', labelKey: 'settings', icon: Settings },
]

export type SecondaryNavItem = {
  to: string
  labelKey: 'stats'
  icon: NavIcon
}

/** Items shown in the side drawer under the "tools" section — not in the bottom nav
 *  so we don't exceed 5 mobile tabs. */
export const secondaryNavItems: SecondaryNavItem[] = [
  { to: '/app/estadisticas', labelKey: 'stats', icon: BarChart3 },
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

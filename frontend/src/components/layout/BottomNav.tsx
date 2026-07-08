import { NavLink } from 'react-router'
import { Clock, House, MoreHorizontal, Target, Timer } from 'lucide-react'
import { clsx } from 'clsx'
import { useT } from '@/i18n/i18n-context'

type Item = {
  to: string
  labelKey: 'home' | 'timer' | 'goals' | 'sessions' | 'more'
  icon: typeof House
  end?: boolean
}

const items: Item[] = [
  { to: '/app', labelKey: 'home', icon: House, end: true },
  { to: '/app/timer', labelKey: 'timer', icon: Timer },
  { to: '/app/metas', labelKey: 'goals', icon: Target },
  { to: '/app/sesiones', labelKey: 'sessions', icon: Clock },
  { to: '/app/mas', labelKey: 'more', icon: MoreHorizontal },
]

function BottomNav() {
  const { t } = useT()
  return (
    <nav
      aria-label={t.nav.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-border)] bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {items.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-2 pb-2 text-xs font-medium transition-colors',
                  isActive ? 'text-apricot' : 'text-[color:var(--color-text-muted)]',
                )
              }
            >
              <Icon size={22} aria-hidden="true" />
              <span>{t.nav[labelKey]}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default BottomNav

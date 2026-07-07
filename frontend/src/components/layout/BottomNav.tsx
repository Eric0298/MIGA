import { NavLink } from 'react-router'
import { Clock, House, MoreHorizontal, Target, Timer } from 'lucide-react'
import { clsx } from 'clsx'

type Item = {
  to: string
  label: string
  icon: typeof House
  end?: boolean
}

const items: Item[] = [
  { to: '/app', label: 'Inicio', icon: House, end: true },
  { to: '/app/timer', label: 'Timer', icon: Timer },
  { to: '/app/metas', label: 'Metas', icon: Target },
  { to: '/app/sesiones', label: 'Sesiones', icon: Clock },
  { to: '/app/mas', label: 'Más', icon: MoreHorizontal },
]

function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-border)] bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {items.map(({ to, label, icon: Icon, end }) => (
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
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default BottomNav

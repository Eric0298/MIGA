import { NavLink } from 'react-router'
import { clsx } from 'clsx'
import { useT } from '@/i18n/i18n-context'
import { mainNavItems } from './nav-items'

function BottomNav() {
  const { t } = useT()
  return (
    <nav
      aria-label={t.nav.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--color-border)] bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {mainNavItems.map(({ to, labelKey, icon: Icon, end }) => (
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

import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { LogOut, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useT } from '@/i18n/i18n-context'
import { useAuth } from '@/features/auth/AuthProvider'
import { authCopyByLanguage } from '@/features/auth/auth-copy'
import { useLogoutFlow } from '@/features/auth/use-logout'
import { estudioSubItems, mainNavItems, secondaryNavItems } from './nav-items'

type Props = {
  open: boolean
  onClose: () => void
}

function SideNavDrawer({ open, onClose }: Props) {
  const { t, lang } = useT()
  const copy = authCopyByLanguage[lang]
  const location = useLocation()
  const auth = useAuth()
  const { logout, busy: logoutBusy } = useLogoutFlow()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    return () => {
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const currentPath = location.pathname
  const previousPathRef = useRef(currentPath)
  useEffect(() => {
    if (previousPathRef.current !== currentPath) {
      previousPathRef.current = currentPath
      onClose()
    }
  }, [currentPath, onClose])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const showLogout = auth.session.authenticated

  return (
    <div
      id="side-nav-drawer"
      aria-hidden={!open}
      className={clsx(
        'fixed inset-0 z-50 transition-opacity duration-200',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <button
        type="button"
        aria-label={t.nav.closeMenu}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="side-nav-drawer-title"
        className={clsx(
          'absolute inset-y-0 left-0 flex h-full w-80 max-w-[85vw] flex-col bg-surface shadow-2xl transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-4">
          <h2
            id="side-nav-drawer-title"
            className="text-sm font-bold tracking-[0.2em] text-charcoal"
          >
            {t.nav.menuTitle.toUpperCase()}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t.nav.closeMenu}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--color-text-muted)] transition-colors hover:bg-peach/40 hover:text-charcoal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <nav aria-label={t.nav.mainNav} className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {mainNavItems.map(({ to, labelKey, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors',
                      isActive ? 'bg-peach/60 text-charcoal' : 'text-charcoal hover:bg-peach/30',
                    )
                  }
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{t.nav[labelKey]}</span>
                </NavLink>
                {labelKey === 'estudio' && (
                  <ul className="mt-1 mb-2 ml-5 flex flex-col gap-1 border-l border-[color:var(--color-border)] pl-3">
                    {estudioSubItems.map(({ to: subTo, icon: SubIcon, label }) => (
                      <li key={subTo}>
                        <NavLink
                          to={subTo}
                          className={({ isActive }) =>
                            clsx(
                              'flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                              isActive
                                ? 'bg-peach/60 text-charcoal'
                                : 'text-[color:var(--color-text-muted)] hover:bg-peach/30 hover:text-charcoal',
                            )
                          }
                        >
                          <SubIcon size={16} aria-hidden="true" />
                          <span>{label(t)}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-6 mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-text-muted)]">
            {t.nav.toolsSection}
          </p>
          <ul className="flex flex-col gap-1">
            {secondaryNavItems.map(({ to, labelKey, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors',
                      isActive ? 'bg-peach/60 text-charcoal' : 'text-charcoal hover:bg-peach/30',
                    )
                  }
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{t.nav[labelKey]}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {showLogout && (
          <footer className="border-t border-[color:var(--color-border)] px-3 py-3">
            <button
              type="button"
              onClick={() => void logout()}
              disabled={logoutBusy}
              aria-busy={logoutBusy}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-charcoal transition-colors hover:bg-peach/40 disabled:opacity-60"
            >
              <LogOut size={18} aria-hidden="true" />
              <span>{logoutBusy ? copy.nav.logoutBusy : copy.nav.logout}</span>
            </button>
          </footer>
        )}
      </aside>
    </div>
  )
}

export default SideNavDrawer

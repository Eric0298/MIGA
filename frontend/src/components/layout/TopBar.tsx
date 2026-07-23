import { forwardRef } from 'react'
import { Menu } from 'lucide-react'
import { useT } from '@/i18n/i18n-context'

type Props = {
  onOpenMenu: () => void
  menuOpen: boolean
}

const TopBar = forwardRef<HTMLButtonElement, Props>(function TopBar(
  { onOpenMenu, menuOpen },
  ref,
) {
  const { t } = useT()
  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center gap-4 border-b border-[color:var(--color-border)] bg-surface/95 px-6 backdrop-blur lg:flex">
      <button
        ref={ref}
        type="button"
        onClick={onOpenMenu}
        aria-expanded={menuOpen}
        aria-controls="side-nav-drawer"
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-surface px-4 py-2 text-xs font-bold tracking-[0.2em] text-charcoal transition-colors hover:bg-peach/40"
      >
        <Menu size={18} aria-hidden="true" />
        <span>{t.nav.openMenu}</span>
      </button>
      <span className="text-lg font-black tracking-tight text-charcoal">MIGA</span>
    </header>
  )
})

export default TopBar

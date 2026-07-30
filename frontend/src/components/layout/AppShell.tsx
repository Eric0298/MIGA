import { useCallback, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import BottomNav from './BottomNav'
import PageContainer from './PageContainer'
import SideNavDrawer from './SideNavDrawer'
import TopBar from './TopBar'
import { DemoBanner } from '@/features/auth/DemoBanner'

function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)

  const openMenu = useCallback(() => setMenuOpen(true), [])
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    // Return focus to the trigger button after close.
    queueMicrotask(() => menuButtonRef.current?.focus?.())
  }, [])

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <TopBar ref={menuButtonRef} onOpenMenu={openMenu} menuOpen={menuOpen} />
      <DemoBanner />
      <SideNavDrawer open={menuOpen} onClose={closeMenu} />

      <main className="flex-1 px-5 pt-8 pb-28 md:px-8 lg:px-10 lg:pt-10 lg:pb-16">
        <PageContainer>
          <Outlet />
        </PageContainer>
      </main>

      <BottomNav />
    </div>
  )
}

export default AppShell

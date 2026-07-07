import { Outlet } from 'react-router'
import BottomNav from './BottomNav'

function AppShell() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex-1 px-5 pt-8 pb-28">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default AppShell

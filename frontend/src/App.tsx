import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import AppShell from '@/components/layout/AppShell'
import Loading from '@/components/ui/Loading'
import HomePage from '@/features/home/HomePage'
import TimerPage from '@/features/timer/TimerPage'
import GoalsPage from '@/features/goals/GoalsPage'
import SessionsPage from '@/features/sessions/SessionsPage'
import MorePage from '@/features/more/MorePage'

const LandingPage = lazy(() => import('@/features/landing/LandingPage'))
const ArchitecturePage = lazy(() => import('@/features/architecture/ArchitecturePage'))
const GoalDetailPage = lazy(() => import('@/features/goals/GoalDetailPage'))
const NotFoundPage = lazy(() => import('@/features/not-found/NotFoundPage'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading fullscreen />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/arquitectura" element={<ArchitecturePage />} />

          <Route path="/app" element={<AppShell />}>
            <Route index element={<HomePage />} />
            <Route path="timer" element={<TimerPage />} />
            <Route path="metas" element={<GoalsPage />} />
            <Route path="metas/:id" element={<GoalDetailPage />} />
            <Route path="sesiones" element={<SessionsPage />} />
            <Route path="mas" element={<MorePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App

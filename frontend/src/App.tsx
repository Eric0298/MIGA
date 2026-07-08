import { BrowserRouter, Route, Routes } from 'react-router'
import LandingPage from '@/features/landing/LandingPage'
import ArchitecturePage from '@/features/architecture/ArchitecturePage'
import NotFoundPage from '@/features/not-found/NotFoundPage'
import AppShell from '@/components/layout/AppShell'
import HomePage from '@/features/home/HomePage'
import TimerPage from '@/features/timer/TimerPage'
import GoalsPage from '@/features/goals/GoalsPage'
import GoalDetailPage from '@/features/goals/GoalDetailPage'
import SessionsPage from '@/features/sessions/SessionsPage'
import MorePage from '@/features/more/MorePage'

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}

export default App

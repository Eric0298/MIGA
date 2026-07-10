import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import AppShell from '@/components/layout/AppShell'
import Loading from '@/components/ui/Loading'
import HomePage from '@/features/home/HomePage'
import TimerPage from '@/features/timer/TimerPage'
import GoalsPage from '@/features/goals/GoalsPage'
import SessionsPage from '@/features/sessions/SessionsPage'
import MorePage from '@/features/more/MorePage'
import EstudioHubPage from '@/features/estudio/EstudioHubPage'

const LandingPage = lazy(() => import('@/features/landing/LandingPage'))
const ArchitecturePage = lazy(() => import('@/features/architecture/ArchitecturePage'))
const GoalDetailPage = lazy(() => import('@/features/goals/GoalDetailPage'))
const NotFoundPage = lazy(() => import('@/features/not-found/NotFoundPage'))
const RepasoPage = lazy(() => import('@/features/estudio/RepasoPage'))
const RepasoGoalPage = lazy(() => import('@/features/estudio/RepasoGoalPage'))
const RepasoSessionPage = lazy(() => import('@/features/estudio/RepasoSessionPage'))
const ExamenesGoalPage = lazy(() => import('@/features/estudio/ExamenesGoalPage'))
const SimulacroCreatePage = lazy(() => import('@/features/estudio/SimulacroCreatePage'))
const SimulacroSessionPage = lazy(() => import('@/features/estudio/SimulacroSessionPage'))
const ApuntesPage = lazy(() => import('@/features/estudio/ApuntesPage'))
const ApuntesGoalPage = lazy(() => import('@/features/estudio/ApuntesGoalPage'))
const ExamenesPage = lazy(() => import('@/features/estudio/ExamenesPage'))

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
            <Route path="estudio" element={<EstudioHubPage />} />
            <Route path="sesiones" element={<SessionsPage />} />
            <Route path="apuntes" element={<ApuntesPage />} />
            <Route path="apuntes/:id" element={<ApuntesGoalPage />} />
            <Route path="repaso" element={<RepasoPage />} />
            <Route path="repaso/:id" element={<RepasoGoalPage />} />
            <Route path="repaso/:id/sesion" element={<RepasoSessionPage />} />
            <Route path="examenes" element={<ExamenesPage />} />
            <Route path="examenes/:id" element={<ExamenesGoalPage />} />
            <Route
              path="examenes/:id/simulacro/nuevo"
              element={<SimulacroCreatePage />}
            />
            <Route
              path="examenes/:id/simulacro/:attemptId"
              element={<SimulacroSessionPage />}
            />
            <Route path="mas" element={<MorePage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App

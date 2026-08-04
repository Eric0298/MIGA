import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router'
import Loading from '@/components/ui/Loading'
import HomePage from '@/features/home/HomePage'
import TimerPage from '@/features/timer/TimerPage'
import GoalsPage from '@/features/goals/GoalsPage'
import SessionsPage from '@/features/sessions/SessionsPage'
import SettingsPage from '@/features/settings/SettingsPage'
import EstudioHubPage from '@/features/estudio/EstudioHubPage'
import ProtectedAppRoute from '@/features/auth/ProtectedAppRoute'
import { useAuth } from '@/features/auth/AuthProvider'
import { WorkspaceSyncProvider } from '@/lib/sync/WorkspaceSyncProvider'

/** Legacy /app/apuntes/:id URLs now live under /app/notas/:id. */
function LegacyApuntesGoalRedirect() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to={`/app/notas/${id}`} replace />
}

const LandingPage = lazy(() => import('@/features/landing/LandingPage'))
const ArchitecturePage = lazy(() => import('@/features/architecture/ArchitecturePage'))
const PrivacyPage = lazy(() => import('@/features/privacy/PrivacyPage'))
const LoginPage = lazy(() => import('@/features/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage'))
const DemoPage = lazy(() => import('@/features/auth/DemoPage'))
const GoalDetailPage = lazy(() => import('@/features/goals/GoalDetailPage'))
const SessionDetailPage = lazy(() => import('@/features/sessions/SessionDetailPage'))
const NotFoundPage = lazy(() => import('@/features/not-found/NotFoundPage'))
const RepasoPage = lazy(() => import('@/features/estudio/RepasoPage'))
const RepasoGoalPage = lazy(() => import('@/features/estudio/RepasoGoalPage'))
const RepasoSessionPage = lazy(() => import('@/features/estudio/RepasoSessionPage'))
const ExamenesGoalPage = lazy(() => import('@/features/estudio/ExamenesGoalPage'))
const SimulacroCreatePage = lazy(() => import('@/features/estudio/SimulacroCreatePage'))
const SimulacroSessionPage = lazy(() => import('@/features/estudio/SimulacroSessionPage'))
const NotasAllPage = lazy(() => import('@/features/estudio/NotasAllPage'))
const NotasGoalPage = lazy(() => import('@/features/estudio/NotasGoalPage'))
const ExamenesPage = lazy(() => import('@/features/estudio/ExamenesPage'))
const QuestionsExamCreatePage = lazy(() => import('@/features/estudio/QuestionsExamCreatePage'))
const QuestionsExamSessionPage = lazy(() => import('@/features/estudio/QuestionsExamSessionPage'))
const EstadisticasPage = lazy(() => import('@/features/estadisticas/EstadisticasPage'))

function AppRoutes() {
  return (
    <Suspense fallback={<Loading fullscreen />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/arquitectura" element={<ArchitecturePage />} />
        <Route path="/privacidad" element={<PrivacyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar" element={<ForgotPasswordPage />} />
        <Route path="/restablecer" element={<ResetPasswordPage />} />
        <Route path="/verificar-email" element={<VerifyEmailPage />} />
        <Route path="/demo" element={<DemoPage />} />

        <Route path="/app" element={<ProtectedAppRoute />}>
          <Route index element={<HomePage />} />
          <Route path="timer" element={<TimerPage />} />
          <Route path="metas" element={<GoalsPage />} />
          <Route path="metas/:id" element={<GoalDetailPage />} />
          <Route path="estudio" element={<EstudioHubPage />} />
          <Route path="sesiones" element={<SessionsPage />} />
          <Route path="sesiones/:id" element={<SessionDetailPage />} />
          <Route path="notas" element={<NotasAllPage />} />
          <Route path="notas/:id" element={<NotasGoalPage />} />
          <Route path="apuntes" element={<Navigate to="/app/notas" replace />} />
          <Route path="apuntes/:id" element={<LegacyApuntesGoalRedirect />} />
          <Route path="repaso" element={<RepasoPage />} />
          <Route path="repaso/:id" element={<RepasoGoalPage />} />
          <Route path="repaso/:id/sesion" element={<RepasoSessionPage />} />
          <Route path="examenes" element={<ExamenesPage />} />
          <Route path="examenes/:id" element={<ExamenesGoalPage />} />
          <Route path="examenes/:id/simulacro/nuevo" element={<SimulacroCreatePage />} />
          <Route path="examenes/:id/simulacro/:attemptId" element={<SimulacroSessionPage />} />
          <Route path="examenes/:id/preguntas/nuevo" element={<QuestionsExamCreatePage />} />
          <Route path="examenes/:id/preguntas/:attemptId" element={<QuestionsExamSessionPage />} />
          <Route path="configuracion" element={<SettingsPage />} />
          <Route path="mas" element={<Navigate to="/app/configuracion" replace />} />
          <Route path="estadisticas" element={<EstadisticasPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

function WorkspaceBoundRoutes() {
  const auth = useAuth()
  const workspace = auth.workspace

  if (!workspace) return <AppRoutes />
  return (
    <WorkspaceSyncProvider
      key={workspace.scopeKey}
      database={workspace.database}
      scopeKey={workspace.scopeKey}
      workspaceId={workspace.workspaceId}
      initialRevision={workspace.revision}
      initialUpdatedAtUtc={workspace.updatedAtUtc}
      initialSyncStatus={workspace.initialSyncStatus}
    >
      <AppRoutes />
    </WorkspaceSyncProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <WorkspaceBoundRoutes />
    </BrowserRouter>
  )
}

export default App

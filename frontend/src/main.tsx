import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import '@fontsource-variable/nunito'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n/i18n-context'
import { AuthProvider } from './features/auth/AuthProvider'
import { PwaUpdatePrompt } from './components/pwa/PwaUpdatePrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <App />
        <PwaUpdatePrompt />
        <Toaster position="top-center" richColors={false} />
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)

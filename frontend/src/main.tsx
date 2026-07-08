import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import '@fontsource-variable/nunito'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n/i18n-context'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
      <Toaster position="top-center" richColors={false} />
    </I18nProvider>
  </StrictMode>,
)

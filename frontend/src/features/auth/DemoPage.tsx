import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import Loading from '@/components/ui/Loading'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from './auth-copy'
import { AuthError, AuthLayout, authPrimaryButtonClass } from './AuthLayout'
import { useAuth } from './AuthProvider'

function DemoPage() {
  const auth = useAuth()
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    if (started.current) return
    started.current = true
    setError(null)
    try {
      await auth.startDemo()
    } catch {
      started.current = false
      setError(copy.common.genericError)
    }
  }

  useEffect(() => {
    if (auth.status === 'ready' && !auth.session.authenticated) void start()
  })

  if (auth.status === 'ready' && auth.session.authenticated) {
    return <Navigate to="/app" replace />
  }

  return (
    <AuthLayout title={copy.demo.title} subtitle={copy.demo.subtitle}>
      <div className="flex flex-col gap-4">
        <AuthError message={error} />
        {!error && (
          <div role="status" className="flex items-center justify-center gap-3 py-6">
            <Loading />
            <span className="text-sm font-semibold text-charcoal">{copy.demo.starting}</span>
          </div>
        )}
        {error && (
          <button className={authPrimaryButtonClass} type="button" onClick={() => void start()}>
            {copy.demo.retry}
          </button>
        )}
      </div>
    </AuthLayout>
  )
}

export default DemoPage

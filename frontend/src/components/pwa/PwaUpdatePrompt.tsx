import { useRegisterSW } from 'virtual:pwa-register/react'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from '@/features/auth/auth-copy'

export function PwaUpdatePrompt() {
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <aside
      role="alertdialog"
      aria-live="polite"
      className="fixed right-4 bottom-24 left-4 z-50 mx-auto max-w-md rounded-2xl bg-charcoal p-4 text-white shadow-xl sm:right-6 sm:bottom-6 sm:left-auto"
    >
      <p className="text-sm font-semibold">{copy.pwa.updateAvailable}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-xl bg-apricot px-3 py-2 text-sm font-semibold"
          onClick={() => void updateServiceWorker(true)}
        >
          {copy.pwa.updateNow}
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold ring-1 ring-white/30"
          onClick={() => setNeedRefresh(false)}
        >
          {copy.pwa.later}
        </button>
      </div>
    </aside>
  )
}

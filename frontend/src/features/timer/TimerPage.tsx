import { useState } from 'react'
import { Timer as TimerIcon } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useT } from '@/i18n/i18n-context'
import { useActiveSession } from './hooks/use-active-session'
import StartSessionPanel from './components/StartSessionPanel'
import TimerDisplay from './components/TimerDisplay'

function TimerPage() {
  const { t } = useT()
  const [showStart, setShowStart] = useState(false)
  const active = useActiveSession()
  const isLoading = active === undefined

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-charcoal">{t.timer.title}</h1>
      </header>

      {isLoading && (
        <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
      )}

      {!isLoading && active && <TimerDisplay session={active} />}

      {!isLoading && !active && showStart && (
        <StartSessionPanel
          onStarted={() => setShowStart(false)}
          onCancel={() => setShowStart(false)}
        />
      )}

      {!isLoading && !active && !showStart && (
        <>
          <EmptyState
            icon={<TimerIcon size={20} aria-hidden="true" />}
            title={t.timer.noActiveTitle}
            description={t.timer.noActiveDescription}
          />
          <button
            type="button"
            onClick={() => setShowStart(true)}
            className="w-full rounded-2xl bg-apricot px-5 py-3.5 text-base font-semibold text-white transition active:scale-[0.98]"
          >
            {t.timer.startSession}
          </button>
        </>
      )}
    </div>
  )
}

export default TimerPage

import { useT } from '@/i18n/i18n-context'

type LoadingProps = {
  fullscreen?: boolean
}

function Loading({ fullscreen = false }: LoadingProps) {
  const { t } = useT()
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullscreen
          ? 'flex min-h-dvh items-center justify-center px-5'
          : 'flex items-center justify-center py-8'
      }
    >
      <p className="text-sm text-[color:var(--color-text-muted)]">{t.common.loading}</p>
    </div>
  )
}

export default Loading

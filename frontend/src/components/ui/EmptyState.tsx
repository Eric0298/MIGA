import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-surface px-6 py-10 text-center">
      {icon && (
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-peach text-charcoal">
          {icon}
        </span>
      )}
      <h2 className="text-lg font-semibold text-charcoal">{title}</h2>
      {description && (
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[color:var(--color-text-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export default EmptyState

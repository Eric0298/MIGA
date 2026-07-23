import { clsx } from 'clsx'
import type { ReactNode } from 'react'

type Variant = 'default' | 'wide'

type Props = {
  children: ReactNode
  variant?: Variant
  className?: string
}

/**
 * Wraps page content with responsive max-widths.
 * - default: max-w-md on mobile, max-w-3xl on md, max-w-7xl on lg
 * - wide:    no max-width on lg (for split-view surfaces like Timer with material)
 */
function PageContainer({ children, variant = 'default', className }: Props) {
  return (
    <div
      className={clsx(
        'mx-auto w-full',
        variant === 'default' && 'max-w-md md:max-w-3xl lg:max-w-7xl',
        variant === 'wide' && 'max-w-md md:max-w-3xl lg:max-w-none',
        className,
      )}
    >
      {children}
    </div>
  )
}

export default PageContainer

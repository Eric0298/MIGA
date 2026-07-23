import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from './auth-copy'

export const authFieldClass =
  'w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 text-base text-charcoal outline-none transition focus:border-apricot focus:ring-2 focus:ring-apricot/20'

export const authPrimaryButtonClass =
  'w-full rounded-2xl bg-apricot px-5 py-3.5 text-base font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

export const authSecondaryButtonClass =
  'w-full rounded-2xl bg-surface px-5 py-3.5 text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  const { lang } = useT()
  const copy = authCopyByLanguage[lang]

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-8 pb-12">
      <Link to="/" aria-label={copy.common.backHome} className="w-fit">
        <img
          src="/brand/04_miga_alt_logo_horizontal_transparent.png"
          alt="Miga"
          className="h-7 w-auto"
        />
      </Link>

      <section className="mt-12 rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
        <h1 className="text-3xl font-extrabold text-charcoal">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
          {subtitle}
        </p>
        <div className="mt-7">{children}</div>
      </section>

      <nav className="mt-auto flex justify-center gap-5 pt-10 text-sm text-[color:var(--color-text-muted)]">
        <Link to="/">{copy.common.backHome}</Link>
        <Link to="/privacidad">{copy.common.privacy}</Link>
      </nav>
    </main>
  )
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
    </p>
  )
}

export function AuthSuccess({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="status"
      className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900"
    >
      {message}
    </p>
  )
}

export function preventEmptySubmit(event: FormEvent<HTMLFormElement>, busy: boolean): boolean {
  if (busy) {
    event.preventDefault()
    return true
  }
  return false
}

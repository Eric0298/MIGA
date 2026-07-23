import { Clock, Target, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from '@/features/auth/auth-copy'

function LandingPage() {
  const { t, lang } = useT()
  const authCopy = authCopyByLanguage[lang]
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-8 pb-16">
      <header className="flex items-center">
        <img
          src="/brand/04_miga_alt_logo_horizontal_transparent.png"
          alt="Miga"
          className="h-7 w-auto"
        />
      </header>

      <section className="mt-12">
        <h1 className="text-4xl leading-tight font-extrabold text-charcoal">
          {t.landing.tagline1}
          <br />
          {t.landing.tagline2}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[color:var(--color-text-muted)]">
          {t.landing.description}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/demo"
            className="w-full rounded-2xl bg-apricot px-5 py-3.5 text-center text-base font-semibold text-white transition active:scale-[0.98]"
          >
            {t.landing.tryGuest}
          </Link>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/registro"
              className="rounded-2xl bg-surface px-4 py-3.5 text-center text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
            >
              {authCopy.login.register}
            </Link>
            <Link
              to="/login"
              className="rounded-2xl bg-surface px-4 py-3.5 text-center text-sm font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
            >
              {authCopy.login.title}
            </Link>
          </div>
          <Link
            to="/arquitectura"
            className="w-full rounded-2xl bg-surface px-5 py-3.5 text-center text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            {t.landing.seeArchitecture}
          </Link>
        </div>
      </section>

      <section aria-labelledby="value" className="mt-14">
        <h2 id="value" className="text-lg font-semibold text-charcoal">
          {t.landing.whyMiga}
        </h2>

        <ul className="mt-4 flex flex-col gap-3">
          <li className="rounded-2xl bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-peach text-charcoal">
                <Clock size={18} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-charcoal">{t.landing.feature1Title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                  {t.landing.feature1Description}
                </p>
              </div>
            </div>
          </li>

          <li className="rounded-2xl bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-peach text-charcoal">
                <Target size={18} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-charcoal">{t.landing.feature2Title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                  {t.landing.feature2Description}
                </p>
              </div>
            </div>
          </li>

          <li className="rounded-2xl bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pistachio text-charcoal">
                <TrendingUp size={18} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-charcoal">{t.landing.feature3Title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                  {t.landing.feature3Description}
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <footer className="mt-14 text-center text-xs text-[color:var(--color-text-muted)]">
        <p>{t.landing.footer}</p>
        <Link className="mt-3 inline-block font-semibold underline" to="/privacidad">
          {authCopy.common.privacy}
        </Link>
      </footer>
    </main>
  )
}

export default LandingPage

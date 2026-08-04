import { Clock, Target, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { useT } from '@/i18n/i18n-context'
import { authCopyByLanguage } from '@/features/auth/auth-copy'

function LandingPage() {
  const { t, lang } = useT()
  const authCopy = authCopyByLanguage[lang]

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        <Link to="/" aria-label="Miga" className="inline-flex">
          <img
            src="/brand/01_miga_primary_logo_with_claim_transparent.png"
            alt="Miga"
            className="h-12 w-auto sm:h-14"
          />
        </Link>
        <nav aria-label={authCopy.common.backHome} className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-charcoal transition hover:bg-peach/60 sm:inline-flex"
          >
            {authCopy.login.title}
          </Link>
          <Link
            to="/registro"
            className="inline-flex rounded-full bg-charcoal px-4 py-2 text-sm font-semibold text-cream transition hover:bg-charcoal/90"
          >
            {authCopy.login.register}
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-6xl px-5 pt-6 pb-14 sm:px-8 sm:pt-10 lg:pt-16 lg:pb-24">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
            <div>
              <h1 className="text-4xl leading-tight font-extrabold text-charcoal sm:text-5xl lg:text-6xl">
                {t.landing.tagline1}
                <br />
                {t.landing.tagline2}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[color:var(--color-text-muted)] sm:text-lg">
                {t.landing.description}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  to="/demo"
                  className="inline-flex items-center justify-center rounded-2xl bg-apricot px-6 py-3.5 text-base font-semibold text-white transition hover:bg-apricot/90 active:scale-[0.98] sm:min-w-[180px]"
                >
                  {t.landing.tryGuest}
                </Link>
                <Link
                  to="/registro"
                  className="inline-flex items-center justify-center rounded-2xl bg-surface px-6 py-3.5 text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition hover:bg-peach/40 active:scale-[0.98] sm:min-w-[180px]"
                >
                  {authCopy.login.register}
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold text-charcoal transition hover:bg-peach/40 sm:hidden"
                >
                  {authCopy.login.title}
                </Link>
                <Link
                  to="/arquitectura"
                  className="inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold text-charcoal transition hover:bg-peach/40"
                >
                  {t.landing.seeArchitecture}
                </Link>
              </div>
            </div>

            <div aria-hidden="true" className="relative hidden lg:block">
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-4 rounded-3xl bg-surface p-6 shadow-sm ring-1 ring-[color:var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-peach text-charcoal">
                      <Clock size={20} />
                    </span>
                    <span className="text-sm font-semibold text-charcoal">
                      {t.landing.feature1Title}
                    </span>
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <p className="font-mono text-5xl leading-none font-bold tracking-tight text-charcoal">
                      01:24
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-pistachio/50 px-3 py-1 text-xs font-semibold text-charcoal">
                      <span className="h-1.5 w-1.5 rounded-full bg-charcoal" />
                      live
                    </span>
                  </div>
                </div>

                <div className="col-span-2 flex flex-col justify-between rounded-3xl bg-peach p-5 ring-1 ring-[color:var(--color-border)]">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-apricot text-white">
                      <TrendingUp size={16} />
                    </span>
                    <span className="font-mono text-lg font-bold text-charcoal">+18%</span>
                  </div>
                  <div className="mt-4 grid grid-cols-7 gap-1">
                    {[
                      'bg-cream',
                      'bg-peach',
                      'bg-apricot/60',
                      'bg-apricot',
                      'bg-pistachio',
                      'bg-apricot',
                      'bg-apricot/60',
                      'bg-peach',
                      'bg-apricot/60',
                      'bg-apricot',
                      'bg-apricot',
                      'bg-pistachio',
                      'bg-apricot/60',
                      'bg-cream',
                      'bg-apricot/60',
                      'bg-apricot',
                      'bg-pistachio',
                      'bg-apricot',
                      'bg-apricot/60',
                      'bg-peach',
                      'bg-cream',
                    ].map((cellClass, index) => (
                      <span
                        key={index}
                        className={`aspect-square rounded-[4px] ${cellClass} ring-1 ring-inset ring-white/40`}
                      />
                    ))}
                  </div>
                </div>

                <div className="col-span-3 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-[color:var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pistachio/60 text-charcoal">
                      <Target size={18} />
                    </span>
                    <span className="text-sm font-semibold text-charcoal">
                      {t.landing.feature2Title}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-2 rounded-full bg-cream">
                      <div className="h-2 w-3/4 rounded-full bg-apricot" />
                    </div>
                    <div className="h-2 rounded-full bg-cream">
                      <div className="h-2 w-1/2 rounded-full bg-apricot" />
                    </div>
                    <div className="h-2 rounded-full bg-cream">
                      <div className="h-2 w-2/3 rounded-full bg-pistachio" />
                    </div>
                  </div>
                </div>

                <div className="col-span-3 rounded-3xl bg-charcoal p-5 text-cream">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-apricot text-white">
                      <TrendingUp size={18} />
                    </span>
                    <span className="text-sm font-semibold">{t.landing.feature3Title}</span>
                  </div>
                  <div className="mt-4 flex h-16 items-end gap-1.5">
                    <div className="h-1/4 w-2 rounded-sm bg-peach" />
                    <div className="h-2/4 w-2 rounded-sm bg-peach" />
                    <div className="h-1/3 w-2 rounded-sm bg-peach" />
                    <div className="h-3/4 w-2 rounded-sm bg-apricot" />
                    <div className="h-2/3 w-2 rounded-sm bg-apricot" />
                    <div className="h-full w-2 rounded-sm bg-pistachio" />
                    <div className="h-4/5 w-2 rounded-sm bg-apricot" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="value"
          className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8 lg:pb-24"
        >
          <h2 id="value" className="text-2xl font-semibold text-charcoal sm:text-3xl">
            {t.landing.whyMiga}
          </h2>

          <ul className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
            <li className="rounded-2xl bg-surface p-5 ring-1 ring-[color:var(--color-border)] sm:p-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-peach text-charcoal">
                  <Clock size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">
                    {t.landing.feature1Title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                    {t.landing.feature1Description}
                  </p>
                </div>
              </div>
            </li>

            <li className="rounded-2xl bg-surface p-5 ring-1 ring-[color:var(--color-border)] sm:p-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-peach text-charcoal">
                  <Target size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">
                    {t.landing.feature2Title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                    {t.landing.feature2Description}
                  </p>
                </div>
              </div>
            </li>

            <li className="rounded-2xl bg-surface p-5 ring-1 ring-[color:var(--color-border)] sm:p-6">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pistachio text-charcoal">
                  <TrendingUp size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-charcoal">
                    {t.landing.feature3Title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                    {t.landing.feature3Description}
                  </p>
                </div>
              </div>
            </li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-[color:var(--color-border)] bg-cream">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-5 py-8 text-center text-xs text-[color:var(--color-text-muted)] sm:flex-row sm:justify-between sm:px-8 sm:text-left">
          <p>{t.landing.footer}</p>
          <Link className="font-semibold text-charcoal underline" to="/privacidad">
            {authCopy.common.privacy}
          </Link>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

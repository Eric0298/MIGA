import { Clock, Target, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'

function LandingPage() {
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
          Small actions.
          <br />
          Big progress.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[color:var(--color-text-muted)]">
          Miga te ayuda a convertir pequeñas acciones diarias en progreso real. Nada de listas
          infinitas, ni presión artificial. Solo tiempo bien usado y avance visible.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/app"
            className="w-full rounded-2xl bg-apricot px-5 py-3.5 text-center text-base font-semibold text-white transition active:scale-[0.98]"
          >
            Probar como invitado
          </Link>
          <Link
            to="/arquitectura"
            className="w-full rounded-2xl bg-surface px-5 py-3.5 text-center text-base font-semibold text-charcoal ring-1 ring-[color:var(--color-border)] transition active:scale-[0.98]"
          >
            Ver arquitectura
          </Link>
        </div>
      </section>

      <section aria-labelledby="value" className="mt-14">
        <h2 id="value" className="text-lg font-semibold text-charcoal">
          Por qué Miga
        </h2>

        <ul className="mt-4 flex flex-col gap-3">
          <li className="rounded-2xl bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-peach text-charcoal">
                <Clock size={18} aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-charcoal">Tiempo real, no promesas</h3>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                  El temporizador se basa en marcas de tiempo. Sobrevive a recargas y bloqueos de
                  pantalla.
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
                <h3 className="text-base font-semibold text-charcoal">Metas honestas</h3>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                  Fija objetivos por tiempo semanal. Miga te dice si vas al día sin dramatizar.
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
                <h3 className="text-base font-semibold text-charcoal">Progreso visible</h3>
                <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text-muted)]">
                  Cada sesión suma. Verás avance real, no rachas vacías.
                </p>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <footer className="mt-14 text-center text-xs text-[color:var(--color-text-muted)]">
        Modo invitado local. Sin cuenta obligatoria.
      </footer>
    </main>
  )
}

export default LandingPage

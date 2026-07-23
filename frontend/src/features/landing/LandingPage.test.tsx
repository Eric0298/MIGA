import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nProvider } from '@/i18n/i18n-context'
import LandingPage from './LandingPage'

function renderLanding() {
  return render(
    <I18nProvider initialLang="es">
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </I18nProvider>,
  )
}

describe('LandingPage', () => {
  it('renders the claim', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Small actions\./i)
  })

  it('has a link to the guest app', () => {
    renderLanding()
    const cta = screen.getByRole('link', { name: /Probar MIGA/i })
    expect(cta).toHaveAttribute('href', '/demo')
  })

  it('has a link to the architecture page', () => {
    renderLanding()
    const cta = screen.getByRole('link', { name: /Ver arquitectura/i })
    expect(cta).toHaveAttribute('href', '/arquitectura')
  })
})

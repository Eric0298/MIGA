import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import LandingPage from './LandingPage'

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage', () => {
  it('renders the claim', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Small actions\./i)
  })

  it('has a link to the guest app', () => {
    renderLanding()
    const cta = screen.getByRole('link', { name: /Probar como invitado/i })
    expect(cta).toHaveAttribute('href', '/app')
  })

  it('has a link to the architecture page', () => {
    renderLanding()
    const cta = screen.getByRole('link', { name: /Ver arquitectura/i })
    expect(cta).toHaveAttribute('href', '/arquitectura')
  })
})

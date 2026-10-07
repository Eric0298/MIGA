import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import LoginPage from './LoginPage'

const authState = vi.hoisted(() => ({
  status: 'loading',
  session: { authenticated: false, accountType: null },
  requiresLogin: false,
  login: vi.fn(),
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => authState,
}))

beforeEach(() => {
  authState.status = 'loading'
  authState.session.authenticated = false
  authState.requiresLogin = false
})

describe('login loading state', () => {
  it('explains that local data is retained after account access ends', () => {
    authState.status = 'ready'
    authState.requiresLogin = true
    render(
      <I18nProvider initialLang="es">
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Tus datos locales se conservan')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })

  it('returns to the interrupted timer route when access is recovered', async () => {
    authState.status = 'ready'
    authState.session.authenticated = true
    render(
      <I18nProvider initialLang="es">
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/app/timer' } }]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app/timer" element={<span>Recovered timer</span>} />
            <Route path="/app" element={<span>Home</span>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(await screen.findByText('Recovered timer')).toBeVisible()
  })

  it('blocks credentials and submit until session discovery finishes', () => {
    render(
      <I18nProvider initialLang="en">
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Password')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })
})

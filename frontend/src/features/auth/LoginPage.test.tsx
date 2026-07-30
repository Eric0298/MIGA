import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import LoginPage from './LoginPage'

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    status: 'loading',
    session: { authenticated: false, accountType: null },
    login: vi.fn(),
  }),
}))

describe('login loading state', () => {
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

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import RegisterPage from './RegisterPage'

const stubs = vi.hoisted(() => ({
  register: vi.fn(),
  syncNow: vi.fn(),
  status: 'ready' as 'ready' | 'loading',
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    status: stubs.status,
    session: {
      authenticated: true,
      accountType: 'demo',
      workspaceId: '110b3428-35a4-4f42-8822-7d23b6c13623',
      email: null,
      emailConfirmed: false,
      expiresAtUtc: '2026-07-24T00:00:00.000Z',
    },
    register: stubs.register,
  }),
}))

vi.mock('@/lib/sync/WorkspaceSyncProvider', () => ({
  useWorkspaceSync: () => ({
    status: 'pending',
    revision: 1,
    lastSyncedAtUtc: null,
    syncNow: stubs.syncNow,
  }),
}))

function VerificationStateProbe() {
  const location = useLocation()
  return <output data-testid="verification-state">{JSON.stringify(location.state)}</output>
}

describe('demo registration', () => {
  beforeEach(() => {
    stubs.register.mockReset()
    stubs.register.mockResolvedValue({ authenticated: false, accountType: null })
    stubs.syncNow.mockReset()
    stubs.status = 'ready'
    localStorage.clear()
  })

  it('blocks demo conversion when the selected data cannot be synchronized first', async () => {
    stubs.syncNow.mockResolvedValue(false)
    const user = userEvent.setup()
    render(
      <I18nProvider initialLang="en">
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'a-long-unique-password')
    await user.type(screen.getByLabelText('Repeat password'), 'a-long-unique-password')
    await user.click(screen.getByLabelText(/I have read and accept/))
    await user.click(screen.getByLabelText(/Copy this demo data/))
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not save the demo changes')
    expect(stubs.syncNow).toHaveBeenCalledOnce()
    expect(stubs.register).not.toHaveBeenCalled()
  })

  it('blocks the form while authentication state is loading', () => {
    stubs.status = 'loading'
    render(
      <I18nProvider initialLang="en">
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(screen.getByLabelText('Email')).toBeDisabled()
  })

  it('passes the explicit demo choice to the immediate verification navigation', async () => {
    stubs.syncNow.mockResolvedValue(true)
    const user = userEvent.setup()
    render(
      <I18nProvider initialLang="en">
        <MemoryRouter initialEntries={['/registro']}>
          <Routes>
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/verificar-email" element={<VerificationStateProbe />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'a-long-unique-password')
    await user.type(screen.getByLabelText('Repeat password'), 'a-long-unique-password')
    await user.click(screen.getByLabelText(/I have read and accept/))
    await user.click(screen.getByLabelText(/Copy this demo data/))
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByTestId('verification-state')).toHaveTextContent(
      JSON.stringify({
        email: 'person@example.com',
        importDemoData: true,
      }),
    )
  })

  it('clears the temporary choice when registration confirms immediately', async () => {
    stubs.syncNow.mockResolvedValue(true)
    stubs.register.mockResolvedValue({
      authenticated: true,
      accountType: 'registered',
      workspaceId: '220b3428-35a4-4f42-8822-7d23b6c13623',
      userId: '330b3428-35a4-4f42-8822-7d23b6c13623',
      email: 'person@example.com',
      emailConfirmed: true,
    })
    const user = userEvent.setup()
    render(
      <I18nProvider initialLang="en">
        <MemoryRouter initialEntries={['/registro']}>
          <Routes>
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/app" element={<span>registered app</span>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText(/^Password/), 'a-long-unique-password')
    await user.type(screen.getByLabelText('Repeat password'), 'a-long-unique-password')
    await user.click(screen.getByLabelText(/I have read and accept/))
    await user.click(screen.getByLabelText(/Copy this demo data/))
    expect(localStorage.getItem('miga.demo-import-preference.v1')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('registered app')).toBeVisible()
    expect(localStorage.getItem('miga.demo-import-preference.v1')).toBeNull()
  })
})

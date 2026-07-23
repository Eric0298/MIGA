import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import RegisterPage from './RegisterPage'

const stubs = vi.hoisted(() => ({
  register: vi.fn(),
  syncNow: vi.fn(),
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    status: 'ready',
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

describe('demo registration', () => {
  beforeEach(() => {
    stubs.register.mockReset()
    stubs.syncNow.mockReset()
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
})

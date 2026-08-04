import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import SettingsPage from './SettingsPage'

const auth = vi.hoisted(() => ({
  deleteLocalData: vi.fn(),
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'ready',
    session: { authenticated: false, accountType: null },
    deleteLocalData: auth.deleteLocalData,
  }),
}))

vi.mock('@/features/auth/AccountPanel', () => ({
  AccountPanel: () => null,
}))

vi.mock('@/lib/db/sessions.repository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/db/sessions.repository')>()),
  getActiveSession: vi.fn(async () => null),
}))

describe('local data deletion', () => {
  beforeEach(() => {
    auth.deleteLocalData.mockReset()
    auth.deleteLocalData.mockResolvedValue(undefined)
  })

  it('uses the explicit auth-level purge instead of clearing a synced snapshot in place', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider initialLang="en">
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: /^Delete all data/ }))
    await user.click(screen.getByRole('button', { name: 'Delete locally and sign out' }))

    expect(auth.deleteLocalData).toHaveBeenCalledOnce()
  })
})

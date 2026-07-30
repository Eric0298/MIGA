import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import { AccountPanel } from './AccountPanel'

const stubs = vi.hoisted(() => ({
  resolveConflict: vi.fn(),
  syncNow: vi.fn(),
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    status: 'ready',
    session: {
      authenticated: true,
      accountType: 'registered',
      workspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'student@example.test',
      emailConfirmed: true,
    },
    logout: vi.fn(),
    changePassword: vi.fn(),
    reauthenticate: vi.fn(),
    exportAccount: vi.fn(),
    deleteAccount: vi.fn(),
    listAccountSessions: vi.fn(),
    revokeAccountSession: vi.fn(),
    revokeOtherAccountSessions: vi.fn(),
  }),
}))

vi.mock('@/lib/sync/WorkspaceSyncProvider', () => ({
  useWorkspaceSync: () => ({
    status: 'conflict',
    revision: 3,
    lastSyncedAtUtc: null,
    syncNow: stubs.syncNow,
    resolveConflict: stubs.resolveConflict,
  }),
}))

describe('AccountPanel conflict controls', () => {
  beforeEach(() => {
    stubs.resolveConflict.mockReset()
    stubs.resolveConflict.mockResolvedValue(true)
    stubs.syncNow.mockReset()
  })

  it('requires confirmation and exposes the keep-local resolution', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(
      <I18nProvider initialLang="en">
        <MemoryRouter>
          <AccountPanel />
        </MemoryRouter>
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Keep this copy' }))

    expect(confirm).toHaveBeenCalledWith(
      expect.stringContaining('replace the server structured data'),
    )
    expect(stubs.resolveConflict).toHaveBeenCalledExactlyOnceWith('keep-local')
  })
})

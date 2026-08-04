import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useLogoutFlow } from './use-logout'

const stubs = vi.hoisted(() => ({
  logout: vi.fn(),
  syncNow: vi.fn(),
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({ logout: stubs.logout }),
}))

vi.mock('@/lib/sync/WorkspaceSyncProvider', () => ({
  useWorkspaceSync: () => ({
    status: 'synced',
    revision: 0,
    lastSyncedAtUtc: null,
    syncNow: stubs.syncNow,
    resolveConflict: vi.fn(),
  }),
}))

function LandingProbe() {
  return <p>landing page</p>
}

function LogoutHarness() {
  const { logout, busy } = useLogoutFlow()
  return (
    <button type="button" onClick={() => void logout()} disabled={busy} aria-busy={busy}>
      logout
    </button>
  )
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/" element={<LandingProbe />} />
        <Route path="/app" element={<LogoutHarness />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('useLogoutFlow', () => {
  beforeEach(() => {
    stubs.logout.mockReset()
    stubs.logout.mockResolvedValue(undefined)
    stubs.syncNow.mockReset()
    stubs.syncNow.mockResolvedValue(true)
  })

  it('syncs then logs out and navigates to the landing page', async () => {
    const user = userEvent.setup()
    render(<TestApp />)

    await user.click(screen.getByRole('button', { name: 'logout' }))

    expect(stubs.syncNow).toHaveBeenCalledOnce()
    expect(stubs.logout).toHaveBeenCalledOnce()
    expect(await screen.findByText('landing page')).toBeVisible()
  })

  it('still logs out when sync fails so pending changes stay local', async () => {
    stubs.syncNow.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<TestApp />)

    await user.click(screen.getByRole('button', { name: 'logout' }))

    expect(stubs.logout).toHaveBeenCalledOnce()
    expect(await screen.findByText('landing page')).toBeVisible()
  })

  it('ignores rapid duplicate clicks while an attempt is in-flight', async () => {
    let releaseLogout: () => void = () => {}
    stubs.logout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseLogout = resolve
        }),
    )
    const user = userEvent.setup()
    render(<TestApp />)

    const button = screen.getByRole('button', { name: 'logout' })
    await user.click(button)
    await user.click(button)
    expect(stubs.logout).toHaveBeenCalledOnce()
    await act(async () => {
      releaseLogout()
    })
  })

  it('re-throws navigation-visible errors after a failed logout', async () => {
    stubs.logout.mockRejectedValueOnce(new Error('network'))
    function ThrowingHarness() {
      const { logout } = useLogoutFlow()
      const navigate = useNavigate()
      return (
        <button
          type="button"
          onClick={async () => {
            try {
              await logout()
            } catch {
              navigate('/', { replace: true })
            }
          }}
        >
          logout
        </button>
      )
    }
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/" element={<LandingProbe />} />
          <Route path="/app" element={<ThrowingHarness />} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'logout' }))
    expect(await screen.findByText('landing page')).toBeVisible()
  })
})

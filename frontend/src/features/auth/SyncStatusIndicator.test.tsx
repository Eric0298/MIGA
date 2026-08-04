import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import { SyncStatusIndicator } from './SyncStatusIndicator'
import type { SyncStatus } from '@/lib/sync/WorkspaceSyncProvider'

const stubs = vi.hoisted(() => ({
  status: 'synced' as SyncStatus,
  accountType: 'registered' as 'registered' | 'demo' | null,
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    session:
      stubs.accountType === null
        ? { authenticated: false, accountType: null }
        : {
            authenticated: true,
            accountType: stubs.accountType,
            workspaceId: '11111111-1111-4111-8111-111111111111',
            email: stubs.accountType === 'registered' ? 'student@example.test' : null,
            emailConfirmed: true,
          },
  }),
}))

vi.mock('@/lib/sync/WorkspaceSyncProvider', () => ({
  useWorkspaceSync: () => ({
    status: stubs.status,
    revision: 0,
    lastSyncedAtUtc: null,
    syncNow: vi.fn(),
    resolveConflict: vi.fn(),
  }),
}))

function renderIndicator() {
  return render(
    <I18nProvider initialLang="en">
      <SyncStatusIndicator />
    </I18nProvider>,
  )
}

describe('SyncStatusIndicator', () => {
  it('renders nothing when the registered workspace is fully synced', () => {
    stubs.status = 'synced'
    stubs.accountType = 'registered'
    const { container } = renderIndicator()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for demo sessions (handled by DemoBanner)', () => {
    stubs.status = 'syncing'
    stubs.accountType = 'demo'
    const { container } = renderIndicator()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for unauthenticated visitors', () => {
    stubs.status = 'error'
    stubs.accountType = null
    const { container } = renderIndicator()
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a discrete status while saving', () => {
    stubs.status = 'syncing'
    stubs.accountType = 'registered'
    renderIndicator()
    expect(screen.getByRole('status')).toHaveTextContent(/saving/i)
  })

  it('escalates offline errors with an alert', () => {
    stubs.status = 'error'
    stubs.accountType = 'registered'
    renderIndicator()
    expect(screen.getByRole('alert')).toHaveTextContent(/offline/i)
  })

  it('flags conflicts as actionable alerts', () => {
    stubs.status = 'conflict'
    stubs.accountType = 'registered'
    renderIndicator()
    expect(screen.getByRole('alert')).toHaveTextContent(/conflict/i)
  })
})

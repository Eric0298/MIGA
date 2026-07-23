import Dexie from 'dexie'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  activateScopedDatabase,
  db,
  deleteAllScopedDatabases,
  getActiveDatabaseName,
  getActiveDatabaseScope,
} from '@/lib/db/miga-db'
import { AuthProvider, useAuth } from './AuthProvider'

const authApi = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
}))

vi.mock('@/lib/api/auth-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/auth-api')>()),
  getAuthSession: authApi.getAuthSession,
}))

function StatusProbe() {
  const auth = useAuth()
  return <span>{auth.status}</span>
}

beforeEach(async () => {
  authApi.getAuthSession.mockReset()
  await deleteAllScopedDatabases()
})

afterEach(async () => {
  await deleteAllScopedDatabases()
})

describe('AuthProvider local retention', () => {
  it('deactivates without deleting the scoped database when the session is unauthenticated', async () => {
    authApi.getAuthSession.mockResolvedValue({
      authenticated: false,
      accountType: null,
    })
    activateScopedDatabase('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    await db.materialBlobs.put({
      id: '99999999-9999-4999-8999-999999999999',
      materialId: null,
      mimeType: 'application/pdf',
      size: 4,
      blob: new Blob(['test'], { type: 'application/pdf' }),
      createdAt: 1,
    })
    const retainedName = getActiveDatabaseName()

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    expect(await screen.findByText('ready')).toBeVisible()
    expect(getActiveDatabaseScope()).toBeNull()
    expect(await Dexie.exists(retainedName)).toBe(true)
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/i18n/i18n-context'
import * as materialProgress from '@/lib/db/material-progress.repository'
import {
  activateScopedDatabase,
  db,
  deactivateScopedDatabase,
  deleteAllScopedDatabases,
} from '@/lib/db/miga-db'
import type { Material, Session } from '@/lib/db/schema'
import TimerActiveMaterial from './TimerActiveMaterial'

vi.mock('@/features/materials/components/PdfViewer', () => ({
  default: ({ onPageRead }: { onPageRead: (page: number) => void }) => (
    <button type="button" onClick={() => onPageRead(1)}>
      read page
    </button>
  ),
}))

vi.mock('@/features/materials/hooks/use-material-aggregated-progress', () => ({
  useMaterialAggregatedProgress: () => ({ resumeSeconds: 0, pagesReadCounts: {} }),
}))

const session: Session = {
  id: '11111111-1111-4111-8111-111111111111',
  goalId: null,
  materialIds: ['22222222-2222-4222-8222-222222222222'],
  startedAt: 1,
  pausedAt: null,
  endedAt: null,
  totalPausedMs: 0,
  status: 'running',
  createdAt: 1,
  updatedAt: 1,
}

const material: Material = {
  id: session.materialIds[0],
  kind: 'pdf',
  title: 'Account PDF',
  fileBlobKey: '33333333-3333-4333-8333-333333333333',
  metadata: { mimeType: 'application/pdf', fileSizeBytes: 4 },
  createdAt: 1,
  updatedAt: 1,
}

afterEach(async () => {
  vi.restoreAllMocks()
  await deactivateScopedDatabase()
  await db.materialProgress.clear()
  await deleteAllScopedDatabases()
})

describe('TimerActiveMaterial cleanup scope', () => {
  it.each(['same-account', 'guest', 'other-account'] as const)(
    'keeps PDF progress in its original scope when unmounting into %s',
    async (nextScope) => {
      const originalDatabase = activateScopedDatabase('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      await originalDatabase.open()
      const persist = vi.spyOn(materialProgress, 'createMaterialProgress')
      const view = render(
        <StrictMode>
          <I18nProvider initialLang="es">
            <TimerActiveMaterial session={session} material={material} />
          </I18nProvider>
        </StrictMode>,
      )
      fireEvent.click(await screen.findByRole('button', { name: 'read page' }))
      if (nextScope === 'guest') {
        await deactivateScopedDatabase()
      } else if (nextScope === 'other-account') {
        activateScopedDatabase('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
      }

      view.unmount()
      await waitFor(() => expect(persist).toHaveBeenCalledOnce())
      await persist.mock.results[0].value.catch(() => undefined)

      if (nextScope === 'same-account') {
        expect(await originalDatabase.materialProgress.toArray()).toEqual([
          expect.objectContaining({
            materialId: material.id,
            sessionId: session.id,
            pagesRead: [1],
            pagesReadCounts: { '1': 1 },
          }),
        ])
      } else {
        expect(await db.materialProgress.count()).toBe(0)
      }
    },
  )
})

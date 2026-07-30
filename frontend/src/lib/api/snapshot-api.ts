import { z } from 'zod'
import { assertSnapshotSize } from '@/lib/db/data-limits'
import { parseImportPayload, type ExportPayload } from '@/lib/db/import-export'
import { apiRequest } from './http'

const snapshotEnvelopeSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    updatedAtUtc: z.string().datetime({ offset: true }),
    data: z.unknown(),
  })
  .strict()

export type SnapshotEnvelope = {
  revision: number
  updatedAtUtc: string
  data: ExportPayload
}

function parseSnapshotEnvelope(raw: unknown): SnapshotEnvelope {
  const envelope = snapshotEnvelopeSchema.parse(raw)
  return {
    revision: envelope.revision,
    updatedAtUtc: envelope.updatedAtUtc,
    data: parseImportPayload(envelope.data),
  }
}

export async function getSnapshot(signal?: AbortSignal): Promise<SnapshotEnvelope> {
  const raw = await apiRequest<unknown>('/api/data/snapshot', { signal, csrf: false })
  return parseSnapshotEnvelope(raw)
}

export async function putSnapshot(
  workspaceId: string,
  revision: number,
  data: ExportPayload,
  signal?: AbortSignal,
): Promise<SnapshotEnvelope> {
  const validatedWorkspaceId = z.string().uuid().parse(workspaceId)
  assertSnapshotSize(data)
  const raw = await apiRequest<unknown>('/api/data/snapshot', {
    method: 'PUT',
    json: { workspaceId: validatedWorkspaceId, revision, data },
    signal,
  })
  return parseSnapshotEnvelope(raw)
}

export { parseSnapshotEnvelope }

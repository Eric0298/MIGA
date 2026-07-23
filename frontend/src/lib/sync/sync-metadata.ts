import { db, type WorkspaceSyncMetadata } from '@/lib/db/miga-db'
import { z } from 'zod'

const metadataSchema = z
  .object({
    id: z.literal('workspace'),
    revision: z.number().int().nonnegative(),
    updatedAtUtc: z.string().datetime({ offset: true }),
    dirty: z.boolean(),
  })
  .strict()

export async function getWorkspaceSyncMetadata(): Promise<WorkspaceSyncMetadata | undefined> {
  const metadata = await db.syncMetadata.get('workspace')
  return metadata === undefined ? undefined : metadataSchema.parse(metadata)
}

export async function putWorkspaceSyncMetadata(
  metadata: Omit<WorkspaceSyncMetadata, 'id'>,
): Promise<void> {
  await db.syncMetadata.put(metadataSchema.parse({ id: 'workspace', ...metadata }))
}

import { db, type MigaDatabase, type WorkspaceSyncMetadata } from '@/lib/db/miga-db'
import { z } from 'zod'

const metadataSchema = z
  .object({
    id: z.literal('workspace'),
    revision: z.number().int().nonnegative(),
    updatedAtUtc: z.string().datetime({ offset: true }),
    dirty: z.boolean(),
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict()

export async function getWorkspaceSyncMetadata(
  database: MigaDatabase = db,
): Promise<WorkspaceSyncMetadata | undefined> {
  const metadata = await database.syncMetadata.get('workspace')
  return metadata === undefined ? undefined : metadataSchema.parse(metadata)
}

export async function putWorkspaceSyncMetadata(
  metadata: Omit<WorkspaceSyncMetadata, 'id'>,
  database: MigaDatabase = db,
): Promise<void> {
  await database.syncMetadata.put(metadataSchema.parse({ id: 'workspace', ...metadata }))
}

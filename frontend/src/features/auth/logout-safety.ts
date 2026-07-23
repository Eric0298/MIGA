import { db } from '@/lib/db/miga-db'

export type LocalBlobSummary = {
  count: number
  bytes: number
}

export async function getLocalBlobSummary(): Promise<LocalBlobSummary> {
  const [materialBlobs, noteBlobs, questionBlobs] = await db.transaction(
    'r',
    [db.materialBlobs, db.noteBlobs, db.questionBlobs],
    () =>
      Promise.all([db.materialBlobs.toArray(), db.noteBlobs.toArray(), db.questionBlobs.toArray()]),
  )
  const blobs = [...materialBlobs, ...noteBlobs, ...questionBlobs]
  return {
    count: blobs.length,
    bytes: blobs.reduce((total, record) => total + record.blob.size, 0),
  }
}

export async function confirmLogoutSafety({
  syncNow,
  inspectLocalBlobs,
  confirm,
  unsyncedMessage,
  localFilesMessage,
}: {
  syncNow: () => Promise<boolean>
  inspectLocalBlobs: () => Promise<LocalBlobSummary>
  confirm: (message: string) => boolean
  unsyncedMessage: string
  localFilesMessage: (summary: LocalBlobSummary) => string
}): Promise<boolean> {
  const synchronized = await syncNow()
  if (!synchronized && !confirm(unsyncedMessage)) return false

  const localBlobs = await inspectLocalBlobs()
  if (localBlobs.count > 0 && !confirm(localFilesMessage(localBlobs))) return false

  return true
}

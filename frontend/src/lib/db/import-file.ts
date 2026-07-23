export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024

export function assertImportFileSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_IMPORT_FILE_BYTES) {
    throw new Error('Import file exceeds the 5 MiB limit')
  }
}

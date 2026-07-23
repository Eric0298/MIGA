import { describe, expect, it } from 'vitest'
import { assertImportFileSize, MAX_IMPORT_FILE_BYTES } from './import-file'

describe('import file size', () => {
  it('accepts the limit and rejects any larger file', () => {
    expect(() => assertImportFileSize(MAX_IMPORT_FILE_BYTES)).not.toThrow()
    expect(() => assertImportFileSize(MAX_IMPORT_FILE_BYTES + 1)).toThrow(/5 MiB/i)
  })
})

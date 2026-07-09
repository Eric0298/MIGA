import { describe, expect, it } from 'vitest'
import { MATERIAL_LIMITS, materialInputSchema } from './schema'

describe('materialInputSchema — pdf', () => {
  it('accepts a valid pdf payload', () => {
    const result = materialInputSchema.safeParse({
      kind: 'pdf',
      title: 'Manual',
      fileBlobKey: 'blob-1',
      metadata: { mimeType: 'application/pdf', fileSizeBytes: 1024, provider: 'pdf' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a pdf with a non-pdf mime type', () => {
    const result = materialInputSchema.safeParse({
      kind: 'pdf',
      title: 'Manual',
      fileBlobKey: 'blob-1',
      metadata: { mimeType: 'image/png', fileSizeBytes: 1024, provider: 'pdf' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message)
      expect(msgs).toContain('fileInvalidType')
    }
  })

  it('rejects a pdf larger than MATERIAL_LIMITS.pdf.maxBytes', () => {
    const result = materialInputSchema.safeParse({
      kind: 'pdf',
      title: 'Manual',
      fileBlobKey: 'blob-1',
      metadata: {
        mimeType: 'application/pdf',
        fileSizeBytes: MATERIAL_LIMITS.pdf.maxBytes + 1,
        provider: 'pdf',
      },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message)
      expect(msgs).toContain('fileTooLarge')
    }
  })

  it('rejects a pdf without fileBlobKey', () => {
    const result = materialInputSchema.safeParse({
      kind: 'pdf',
      title: 'Manual',
      metadata: {},
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message)
      expect(msgs).toContain('fileRequired')
    }
  })
})

describe('materialInputSchema — video-upload', () => {
  it('accepts any video/* mime type', () => {
    for (const mime of ['video/mp4', 'video/webm', 'video/quicktime']) {
      const result = materialInputSchema.safeParse({
        kind: 'video-upload',
        title: 'Clase 1',
        fileBlobKey: 'blob-1',
        metadata: { mimeType: mime, fileSizeBytes: 1024, provider: 'upload' },
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects a non-video mime type for video-upload', () => {
    const result = materialInputSchema.safeParse({
      kind: 'video-upload',
      title: 'Clase 1',
      fileBlobKey: 'blob-1',
      metadata: { mimeType: 'application/pdf', fileSizeBytes: 1024, provider: 'upload' },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message)
      expect(msgs).toContain('fileInvalidType')
    }
  })

  it('rejects a video larger than MATERIAL_LIMITS.videoUpload.maxBytes', () => {
    const result = materialInputSchema.safeParse({
      kind: 'video-upload',
      title: 'Clase 1',
      fileBlobKey: 'blob-1',
      metadata: {
        mimeType: 'video/mp4',
        fileSizeBytes: MATERIAL_LIMITS.videoUpload.maxBytes + 1,
        provider: 'upload',
      },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message)
      expect(msgs).toContain('fileTooLarge')
    }
  })
})

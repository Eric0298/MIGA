import { describe, expect, it } from 'vitest'
import {
  assertSnapshotSize,
  MAX_HTTP_URL_CHARS,
  MAX_SNAPSHOT_UTF8_BYTES,
  SnapshotSizeLimitError,
} from './data-limits'
import { materialInputSchema, noteInputSchema, startSessionInputSchema } from './schema'

describe('shared local and snapshot limits', () => {
  it('rejects local URLs that cannot be represented in a snapshot', () => {
    const url = `https://example.test/${'a'.repeat(MAX_HTTP_URL_CHARS)}`
    expect(
      materialInputSchema.safeParse({
        kind: 'link',
        title: 'Too long',
        url,
        metadata: {},
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate and over-limit relationship collections locally', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(startSessionInputSchema.safeParse({ goalId: null, materialIds: [id, id] }).success).toBe(
      false,
    )
    expect(
      noteInputSchema.safeParse({
        goalIds: Array.from(
          { length: 101 },
          (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`,
        ),
        kind: 'text',
        title: 'Too many goals',
        text: 'Text',
      }).success,
    ).toBe(false)
  })

  it('fails the UTF-8 snapshot preflight before a request is attempted', () => {
    expect(() => assertSnapshotSize({ data: 'a'.repeat(MAX_SNAPSHOT_UTF8_BYTES) })).toThrow(
      SnapshotSizeLimitError,
    )
  })
})

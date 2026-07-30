import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchYouTubeMetadata,
  isProbablyYouTubeUrl,
  type YouTubeMetadata,
  type YouTubeMetadataError,
} from './youtube-metadata'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isProbablyYouTubeUrl', () => {
  it('accepts common YouTube URLs', () => {
    expect(isProbablyYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true)
    expect(isProbablyYouTubeUrl('https://youtu.be/abc')).toBe(true)
    expect(isProbablyYouTubeUrl('https://m.youtube.com/watch?v=abc')).toBe(true)
    expect(isProbablyYouTubeUrl('https://www.youtube-nocookie.com/embed/abc')).toBe(true)
  })

  it('rejects non-YouTube URLs', () => {
    expect(isProbablyYouTubeUrl('https://vimeo.com/12345')).toBe(false)
    expect(isProbablyYouTubeUrl('https://evil.example.com/youtube.com')).toBe(false)
    expect(isProbablyYouTubeUrl('javascript:alert(1)')).toBe(false)
    expect(isProbablyYouTubeUrl('https://user:password@youtube.com/watch?v=abc')).toBe(false)
    expect(isProbablyYouTubeUrl('https://youtube.com\\@attacker.invalid/watch?v=abc')).toBe(false)
    expect(isProbablyYouTubeUrl('')).toBe(false)
    expect(isProbablyYouTubeUrl('not a url')).toBe(false)
  })
})

describe('fetchYouTubeMetadata', () => {
  it('returns success when the backend responds 200', async () => {
    const dto: YouTubeMetadata = {
      provider: 'youtube',
      videoId: 'abc12345678',
      title: 'Test',
      author: 'Ch',
      thumbnailUrl: 'https://i.ytimg.com/vi/abc12345678/hqdefault.jpg',
      durationSeconds: 90,
    }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(dto), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await fetchYouTubeMetadata('https://youtu.be/abc12345678')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.videoId).toBe('abc12345678')
      expect(result.data.durationSeconds).toBe(90)
    }
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]
    const parsedRequestUrl = new URL(String(requestUrl))
    expect(parsedRequestUrl.origin).toBe(window.location.origin)
    expect(parsedRequestUrl.pathname).toBe('/api/materials/youtube-metadata')
    expect(requestInit?.credentials).toBe('include')
    expect(requestInit?.cache).toBe('no-store')
  })

  it('rejects a malformed success DTO', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          provider: 'youtube',
          videoId: 'not-valid',
          title: 'Test',
          author: 'Ch',
          thumbnailUrl: 'javascript:alert(1)',
          durationSeconds: 90,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )

    await expect(fetchYouTubeMetadata('https://youtu.be/abc12345678')).resolves.toEqual({
      success: false,
      error: { code: 'invalid_response', message: 'invalid_response' },
    })
  })

  it('returns the backend error body when non-2xx', async () => {
    const err: YouTubeMetadataError = { code: 'video_not_found', message: 'not found' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(err), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const result = await fetchYouTubeMetadata('https://youtu.be/abc12345678')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('video_not_found')
    }
  })

  it('falls back to a status-based code when the error body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('gateway timeout', { status: 502 }),
    )

    const result = await fetchYouTubeMetadata('https://youtu.be/abc12345678')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('upstream_error')
    }
  })

  it('returns network_error when fetch throws (not aborted)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('failed'))

    const result = await fetchYouTubeMetadata('https://youtu.be/abc12345678')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('network_error')
    }
  })

  it('rethrows AbortError so callers can distinguish cancellations', async () => {
    const abort = new DOMException('aborted', 'AbortError')
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abort)

    await expect(fetchYouTubeMetadata('https://youtu.be/abc12345678')).rejects.toBe(abort)
  })
})

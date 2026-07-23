import { z } from 'zod'
import { ApiError, apiRequest } from './http'

export type YouTubeMetadata = {
  provider: string
  videoId: string
  title: string
  author: string
  thumbnailUrl: string
  durationSeconds: number
}

export type YouTubeMetadataError = {
  code: string
  message: string
}

export type YouTubeMetadataResult =
  { success: true; data: YouTubeMetadata } | { success: false; error: YouTubeMetadataError }

const YOUTUBE_HOSTNAME_REGEX = /(?:^|\.)(?:youtube(?:-nocookie)?\.com|youtu\.be)$/i
const httpUrl = z
  .string()
  .max(2_048)
  .refine((raw) => {
    try {
      if (raw.includes('\\')) return false
      const parsed = new URL(raw)
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.username === '' &&
        parsed.password === ''
      )
    } catch {
      return false
    }
  })
const youtubeMetadataSchema = z
  .object({
    provider: z.literal('youtube'),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    title: z.string().min(1).max(500),
    author: z.string().max(200),
    thumbnailUrl: httpUrl,
    durationSeconds: z
      .number()
      .int()
      .nonnegative()
      .max(60 * 60 * 24 * 365),
  })
  .strict()

export function isProbablyYouTubeUrl(raw: string): boolean {
  if (!raw) return false
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 2048) return false
  try {
    if (trimmed.includes('\\')) return false
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    if (parsed.username || parsed.password) return false
    return YOUTUBE_HOSTNAME_REGEX.test(parsed.host)
  } catch {
    return false
  }
}

export async function fetchYouTubeMetadata(
  url: string,
  signal?: AbortSignal,
): Promise<YouTubeMetadataResult> {
  const params = new URLSearchParams({ url })
  try {
    const raw = await apiRequest<unknown>(`/api/materials/youtube-metadata?${params.toString()}`, {
      method: 'GET',
      csrf: false,
      signal,
    })
    const parsed = youtubeMetadataSchema.safeParse(raw)
    if (!parsed.success) {
      return {
        success: false,
        error: { code: 'invalid_response', message: 'invalid_response' },
      }
    }
    return { success: true, data: parsed.data }
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    if (cause instanceof ApiError) {
      const fallbackCode = mapStatusToCode(cause.status)
      const code = cause.problem?.code ?? fallbackCode
      return {
        success: false,
        error: {
          code,
          message: cause.problem?.detail ?? cause.problem?.title ?? code,
        },
      }
    }
    return {
      success: false,
      error: { code: 'network_error', message: 'network_error' },
    }
  }
}

function mapStatusToCode(status: number): string {
  if (status === 400) return 'invalid_url'
  if (status === 404) return 'video_not_found'
  if (status === 429) return 'rate_limited'
  if (status === 503) return 'service_unavailable'
  if (status === 502) return 'upstream_error'
  return 'unknown'
}

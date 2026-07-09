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

export function isProbablyYouTubeUrl(raw: string): boolean {
  if (!raw) return false
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > 2048) return false
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return YOUTUBE_HOSTNAME_REGEX.test(parsed.host)
  } catch {
    return false
  }
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL
  if (typeof configured === 'string' && configured.length > 0) {
    return configured.replace(/\/$/, '')
  }
  return 'http://localhost:5161'
}

export async function fetchYouTubeMetadata(
  url: string,
  signal?: AbortSignal,
): Promise<YouTubeMetadataResult> {
  const params = new URLSearchParams({ url })
  const endpoint = `${getApiBaseUrl()}/api/materials/youtube-metadata?${params.toString()}`

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
      credentials: 'omit',
      mode: 'cors',
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause
    }
    return {
      success: false,
      error: { code: 'network_error', message: 'network_error' },
    }
  }

  if (response.ok) {
    const data = (await response.json()) as YouTubeMetadata
    return { success: true, data }
  }

  let errorPayload: YouTubeMetadataError | null = null
  try {
    errorPayload = (await response.json()) as YouTubeMetadataError
  } catch {
    errorPayload = null
  }

  const fallbackCode = mapStatusToCode(response.status)
  return {
    success: false,
    error: errorPayload ?? { code: fallbackCode, message: fallbackCode },
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

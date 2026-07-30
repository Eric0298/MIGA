const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CSRF_HEADER = 'X-XSRF-TOKEN'

export type ApiProblem = {
  status?: number
  title?: string
  detail?: string
  code?: string
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem: ApiProblem | null
  readonly retryAfterMs: number | null

  constructor(status: number, problem: ApiProblem | null, retryAfterMs: number | null = null) {
    super(problem?.title ?? problem?.detail ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.retryAfterMs = retryAfterMs
  }
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  json?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  csrf?: boolean
}

export type ApiAuthorizationFailure = {
  path: string
  error: ApiError
}

let csrfToken: string | null = null
let csrfRequest: Promise<string> | null = null
const authorizationFailureListeners = new Set<(failure: ApiAuthorizationFailure) => void>()

export function subscribeToApiAuthorizationFailures(
  listener: (failure: ApiAuthorizationFailure) => void,
): () => void {
  authorizationFailureListeners.add(listener)
  return () => authorizationFailureListeners.delete(listener)
}

function notifyAuthorizationFailure(path: string, error: ApiError): void {
  if ((error.status !== 401 && error.status !== 403) || path === '/api/auth/session') {
    return
  }

  for (const listener of authorizationFailureListeners) {
    try {
      listener({ path, error })
    } catch {
      // A consumer cannot interfere with delivery of the original API error.
    }
  }
}

function configuredApiBase(): URL {
  const origin =
    typeof window === 'undefined' ? new URL('http://localhost') : new URL(window.location.origin)
  const configured = import.meta.env.VITE_API_URL?.trim() || '/'
  if (configured.includes('\\')) {
    throw new Error('VITE_API_URL must not contain backslashes')
  }
  const base = new URL(configured, origin)

  if (base.origin !== origin.origin || base.username || base.password) {
    throw new Error('VITE_API_URL must resolve to the same origin as the application')
  }

  return base
}

export function resolveApiUrl(path: string): URL {
  if (!path.startsWith('/api/')) {
    throw new Error('API paths must start with /api/')
  }
  return new URL(path, configuredApiBase())
}

async function parseProblem(response: Response): Promise<ApiProblem | null> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) return null

  try {
    const raw = (await response.json()) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    const value = raw as Record<string, unknown>
    const errors =
      value.errors && typeof value.errors === 'object' && !Array.isArray(value.errors)
        ? Object.fromEntries(
            Object.entries(value.errors).flatMap(([key, messages]) =>
              Array.isArray(messages) && messages.every((message) => typeof message === 'string')
                ? [[key, messages]]
                : [],
            ),
          )
        : undefined

    return {
      status: typeof value.status === 'number' ? value.status : undefined,
      title: typeof value.title === 'string' ? value.title : undefined,
      detail: typeof value.detail === 'string' ? value.detail : undefined,
      code: typeof value.code === 'string' ? value.code : undefined,
      errors,
    }
  } catch {
    return null
  }
}

function parseRetryAfter(response: Response): number | null {
  const raw = response.headers.get('retry-after')
  if (!raw) return null
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 60 * 60 * 1_000)
  const at = Date.parse(raw)
  if (!Number.isFinite(at)) return null
  return Math.max(0, Math.min(at - Date.now(), 60 * 60 * 1_000))
}

async function apiErrorFromResponse(path: string, response: Response): Promise<ApiError> {
  const error = new ApiError(
    response.status,
    await parseProblem(response),
    parseRetryAfter(response),
  )
  notifyAuthorizationFailure(path, error)
  return error
}

async function requestCsrfToken(force = false): Promise<string> {
  if (!force && csrfToken) return csrfToken
  if (!force && csrfRequest) return csrfRequest

  const request = fetch(resolveApiUrl('/api/auth/csrf'), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    redirect: 'error',
    referrerPolicy: 'same-origin',
  })
    .then(async (response) => {
      if (!response.ok) {
        throw await apiErrorFromResponse('/api/auth/csrf', response)
      }
      const payload = (await response.json()) as unknown
      if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload) ||
        typeof (payload as { requestToken?: unknown }).requestToken !== 'string' ||
        (payload as { requestToken: string }).requestToken.length < 16
      ) {
        throw new Error('Invalid antiforgery response')
      }
      const token = (payload as { requestToken: string }).requestToken
      csrfToken = token
      return token
    })
    .finally(() => {
      csrfRequest = null
    })

  csrfRequest = request
  return request
}

function createRequestInit(
  method: NonNullable<ApiRequestOptions['method']>,
  options: ApiRequestOptions,
  token: string | null,
): RequestInit {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.json !== undefined) headers.set('Content-Type', 'application/json')
  if (token) headers.set(CSRF_HEADER, token)

  return {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers,
    body: options.json === undefined ? undefined : JSON.stringify(options.json),
    signal: options.signal,
    redirect: 'error',
    referrerPolicy: 'same-origin',
  }
}

async function send(
  path: string,
  options: ApiRequestOptions,
  retryCsrf: boolean,
): Promise<Response> {
  const method = options.method ?? 'GET'
  const needsCsrf = (options.csrf ?? true) && UNSAFE_METHODS.has(method)
  const token = needsCsrf ? await requestCsrfToken() : null
  const response = await fetch(resolveApiUrl(path), createRequestInit(method, options, token))

  if (needsCsrf && retryCsrf && response.status === 400) {
    const problem = await parseProblem(response.clone())
    if (problem?.code === 'csrf_invalid') {
      csrfToken = null
      const refreshed = await requestCsrfToken(true)
      return fetch(resolveApiUrl(path), createRequestInit(method, options, refreshed))
    }
  }

  return response
}

export async function apiRequest<T = undefined>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await send(path, options, true)
  if (!response.ok) {
    throw await apiErrorFromResponse(path, response)
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('json')) return undefined as T
  return (await response.json()) as T
}

export async function apiDownload(path: string): Promise<Blob> {
  const response = await send(path, { method: 'GET' }, false)
  if (!response.ok) {
    throw await apiErrorFromResponse(path, response)
  }
  return response.blob()
}

export function clearInMemoryCsrfToken(): void {
  csrfToken = null
  csrfRequest = null
}

/** Test-only reset; no credentials or tokens are persisted outside this module. */
export function resetApiClientForTests(): void {
  clearInMemoryCsrfToken()
}

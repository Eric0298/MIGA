import { z } from 'zod'
import { apiDownload, apiRequest, clearInMemoryCsrfToken } from './http'

const unauthenticatedSessionSchema = z
  .object({
    authenticated: z.literal(false),
    accountType: z.null(),
    workspaceId: z.string().uuid().nullish(),
    userId: z.string().uuid().nullish(),
    email: z.string().email().nullish(),
    expiresAtUtc: z.string().datetime({ offset: true }).nullish(),
    emailConfirmed: z.boolean().nullish(),
  })
  .strict()

const authenticatedSessionSchema = z
  .object({
    authenticated: z.literal(true),
    accountType: z.enum(['demo', 'registered']),
    workspaceId: z.string().uuid(),
    userId: z.string().uuid().nullish(),
    email: z.string().email().nullish(),
    expiresAtUtc: z.string().datetime({ offset: true }).nullish(),
    emailConfirmed: z.boolean().nullish(),
  })
  .strict()

export const authSessionSchema = z.union([unauthenticatedSessionSchema, authenticatedSessionSchema])

export type AuthSession = z.infer<typeof authSessionSchema>
export type AuthenticatedSession = z.infer<typeof authenticatedSessionSchema>

export type RegisterInput = {
  email: string
  password: string
  privacyPolicyVersion: '2026-07-23'
  importDemoData: boolean
}

export type ResetPasswordInput = {
  email: string
  token: string
  newPassword: string
}

export type ConfirmEmailInput = {
  userId: string
  token: string
  importDemoData: boolean
  continueWithoutDemoData: boolean
}

const accountSessionSchema = z
  .object({
    sessionId: z.string().uuid(),
    createdAtUtc: z.string().datetime({ offset: true }),
    lastSeenAtUtc: z.string().datetime({ offset: true }),
    expiresAtUtc: z.string().datetime({ offset: true }),
    current: z.boolean(),
  })
  .strict()

export type AccountSession = z.infer<typeof accountSessionSchema>

export async function getAuthSession(signal?: AbortSignal): Promise<AuthSession> {
  const raw = await apiRequest<unknown>('/api/auth/session', { signal, csrf: false })
  return authSessionSchema.parse(raw)
}

export async function startDemo(): Promise<void> {
  await apiRequest('/api/auth/demo', { method: 'POST' })
}

export async function register(input: RegisterInput): Promise<void> {
  await apiRequest('/api/auth/register', { method: 'POST', json: input })
}

export async function login(email: string, password: string): Promise<void> {
  await apiRequest('/api/auth/login', { method: 'POST', json: { email, password } })
}

export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout', { method: 'POST' })
  clearInMemoryCsrfToken()
}

export async function forgotPassword(email: string): Promise<void> {
  await apiRequest('/api/auth/forgot-password', { method: 'POST', json: { email } })
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  await apiRequest('/api/auth/reset-password', { method: 'POST', json: input })
}

export async function confirmEmail(input: ConfirmEmailInput): Promise<void> {
  await apiRequest('/api/auth/confirm-email', { method: 'POST', json: input })
}

export async function resendConfirmation(email: string): Promise<void> {
  await apiRequest('/api/auth/resend-confirmation', { method: 'POST', json: { email } })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest('/api/auth/change-password', {
    method: 'POST',
    json: { currentPassword, newPassword },
  })
  clearInMemoryCsrfToken()
}

export async function reauthenticate(currentPassword: string): Promise<void> {
  await apiRequest('/api/auth/reauthenticate', {
    method: 'POST',
    json: { currentPassword },
  })
}

export async function listAccountSessions(): Promise<AccountSession[]> {
  const raw = await apiRequest<unknown>('/api/account/sessions', { csrf: false })
  return z.array(accountSessionSchema).max(100).parse(raw)
}

export async function revokeAccountSession(sessionId: string): Promise<void> {
  const validatedId = z.string().uuid().parse(sessionId)
  await apiRequest(`/api/account/sessions/${encodeURIComponent(validatedId)}`, {
    method: 'DELETE',
  })
}

export async function revokeOtherAccountSessions(): Promise<void> {
  await apiRequest('/api/account/sessions/others', { method: 'DELETE' })
}

export function exportAccount(): Promise<Blob> {
  return apiDownload('/api/account/export')
}

export async function deleteAccount(currentPassword: string): Promise<void> {
  await apiRequest('/api/account', {
    method: 'DELETE',
    json: { currentPassword, confirmation: 'DELETE' },
  })
  clearInMemoryCsrfToken()
}
